# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing
from datetime import datetime, timezone


class MintGuard(gl.Contract):
    check_count: i32
    checks: TreeMap[str, str]

    def __init__(self):
        self.check_count = i32(0)

    @gl.public.write.payable
    def request_check(self, image_url: str, title: str, creator_claim: str) -> i32:
        value = gl.message.value
        if value == u256(0):
            raise gl.vm.UserError("Must pay verification fee")

        self.check_count = i32(int(self.check_count) + 1)
        check_id = str(int(self.check_count))
        now = int(datetime.now(timezone.utc).timestamp())

        check = {
            "id": check_id,
            "requester": str(gl.message.sender_address),
            "image_url": image_url,
            "title": title,
            "creator_claim": creator_claim,
            "fee": str(value),
            "status": 0,
            "report": "",
            "created_at": now,
        }
        self.checks[check_id] = json.dumps(check)
        return self.check_count

    @gl.public.write
    def verify_originality(self, check_id: str) -> typing.Any:
        check = json.loads(self.checks[check_id])
        if check["status"] != 0:
            raise gl.vm.UserError("Already verified")

        image_url = check["image_url"]
        title = check["title"]
        creator_claim = check["creator_claim"]

        def _analyze(url: str, ttl: str, creator: str) -> dict:
            """Fetch page and run LLM analysis, returning a normalized result dict."""
            web_data = gl.nondet.web.get(url).body.decode("utf-8")
            prompt = f"""You are an NFT authenticity and originality checker.

IMAGE/NFT URL: {url}
CLAIMED TITLE: {ttl}
CREATOR CLAIM: {creator}

PAGE CONTENT: {web_data[:2000]}

Analyze:
1. Does this appear to be original artwork or a copy/derivative?
2. Are there signs of AI generation without disclosure?
3. Does the metadata/page suggest the claimed creator is authentic?
4. Any red flags (stolen art patterns, known collections being copied)?

You MUST respond with ONLY a valid JSON object, no extra text.
Use exactly these keys and value types:
- "is_original": boolean (true or false)
- "confidence": integer from 1 to 10
- "category": one of "original", "derivative", "copy", "ai_generated", "suspicious"
- "reasoning": a single short sentence
- "red_flags": a JSON array of short strings (can be empty [])

Example:
{{"is_original": true, "confidence": 8, "category": "original", "reasoning": "The artwork appears unique.", "red_flags": []}}"""
            response = gl.nondet.exec_prompt(prompt)
            # Sanitize: strip any markdown fences or whitespace around JSON
            cleaned = response.strip()
            if cleaned.startswith("```"):
                # Remove markdown code fences
                lines = cleaned.split("\n")
                lines = [l for l in lines if not l.strip().startswith("```")]
                cleaned = "\n".join(lines).strip()
            parsed = json.loads(cleaned)
            # Normalize fields to ensure consistent types for comparison
            normalized = {
                "is_original": bool(parsed.get("is_original", False)),
                "confidence": max(1, min(10, int(parsed.get("confidence", 5)))),
                "category": str(parsed.get("category", "suspicious")).lower().strip(),
                "reasoning": str(parsed.get("reasoning", "")).strip(),
                "red_flags": [str(f).strip() for f in parsed.get("red_flags", []) if str(f).strip()],
            }
            # Validate category is one of allowed values
            allowed = {"original", "derivative", "copy", "ai_generated", "suspicious"}
            if normalized["category"] not in allowed:
                normalized["category"] = "suspicious"
            return normalized

        def leader_fn():
            return _analyze(image_url, title, creator_claim)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            leader_data = leader_result.calldata
            # Validate leader result has required fields
            if not isinstance(leader_data, dict):
                return False
            required_keys = {"is_original", "confidence", "category", "reasoning", "red_flags"}
            if not required_keys.issubset(leader_data.keys()):
                return False
            # Run independent analysis
            validator_data = _analyze(image_url, title, creator_claim)
            # Compare normalized results — boolean and category must match,
            # confidence within tolerance of 2
            return (leader_data["is_original"] == validator_data["is_original"]
                    and leader_data["category"] == validator_data["category"]
                    and abs(int(leader_data["confidence"]) - int(validator_data["confidence"])) <= 2)

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        check["status"] = 1 if result["is_original"] else 2
        check["report"] = json.dumps(result)
        self.checks[check_id] = json.dumps(check)

    @gl.public.view
    def get_check(self, check_id: str) -> str:
        return self.checks[check_id]

    @gl.public.view
    def get_check_count(self) -> i32:
        return self.check_count
