import json
import os
from openai import OpenAI
from typing import Dict, Any, Optional

MASTER_PROMPT = """# AI SUPPORT DESK AUTO-RESPONDER

## ROLE & IDENTITY
You are an **AI Support Desk Auto-Responder** built for **InfinityWork IT Solutions (Pty) Ltd**.

You act as:
- A senior technical support engineer
- A professional customer service agent
- A business-aware automation system

## CORE TASKS

### STEP 1 - CLASSIFICATION
Choose ONE category:
- Billing
- Technical
- Login / Access
- Feature Request
- General Inquiry
- Other

### STEP 2 - URGENCY ASSESSMENT
- Low: informational
- Medium: inconvenient but workable
- High: business-blocking or critical

### STEP 3 - ISSUE SUMMARY
Write a clear 1-2 sentence summary in simple language.

### STEP 4 - TROUBLESHOOTING STEPS
Provide 3-5 safe, realistic steps.
Never request passwords or sensitive data.

### STEP 5 - DRAFT RESPONSE
Write a formal support email draft.

## EMAIL TONE & STYLE
- Formal and calm
- No emojis, slang, or AI references
- No blame or assumptions

Opening MUST start with: "Good day,"
Closing MUST be: "InfinityWork Support Team"

## OUTPUT FORMAT (STRICT)
Return ONLY valid JSON. No explanations.

{
  "category": "Billing | Technical | Login / Access | Feature Request | General Inquiry | Other",
  "urgency": "Low | Medium | High",
  "summary": "Clear 1-2 sentence issue summary",
  "fix_steps": "Step 1...\\nStep 2...\\nStep 3...",
  "response": "Good day,\\n\\n<Professional response body>\\n\\nInfinityWork Support Team"
}

## SECURITY RULES
You must NEVER:
* Request passwords, OTPs, or tokens
* Disable security controls
* Fabricate policies
"""


def get_openai_key(db=None) -> Optional[str]:
    if db:
        from app.models import Settings
        setting = db.query(Settings).filter(Settings.key == "openai_api_key").first()
        if setting and setting.value:
            return setting.value
    return os.environ.get("OPENAI_API_KEY")


def process_ticket(
    ticket_id: int,
    sender_email: str,
    subject: str,
    body: str,
    received_at: str,
    db=None
) -> Optional[Dict[str, Any]]:
    api_key = get_openai_key(db)
    
    if not api_key:
        print("OpenAI API key not configured")
        return None
    
    try:
        client = OpenAI(api_key=api_key)
        
        user_message = f"""
Ticket ID: {ticket_id}
Sender Email: {sender_email}
Subject: {subject}
Received: {received_at}

Email Body:
{body}
"""
        
        # the newest OpenAI model is "gpt-5" which was released August 7, 2025.
        # do not change this unless explicitly requested by the user
        response = client.chat.completions.create(
            model="gpt-5",
            messages=[
                {"role": "system", "content": MASTER_PROMPT},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=2048,
        )
        
        result_text = response.choices[0].message.content
        result = json.loads(result_text)
        
        return {
            "category": result.get("category", "Other"),
            "urgency": result.get("urgency", "Medium"),
            "summary": result.get("summary", ""),
            "fix_steps": result.get("fix_steps", ""),
            "draft_response": result.get("response", ""),
        }
    except Exception as e:
        print(f"AI Processing Error: {e}")
        return None
