"""
AI Service Module
=================
This module integrates with OpenAI to process support tickets automatically.

The AI analyzes incoming emails and:
1. Classifies them by category (Billing, Technical, Login/Access, etc.)
2. Assesses urgency (Low, Medium, High)
3. Generates a summary of the customer's issue
4. Suggests troubleshooting steps for the support team
5. Drafts a professional response for human review

IMPORTANT: All AI-generated responses require human approval before sending.
This is a safety feature to prevent inappropriate or incorrect responses.

REQUIREMENTS:
- OPENAI_API_KEY environment variable or setting in database
- Active OpenAI account with API access

TROUBLESHOOTING:
- "OpenAI API key not configured": Set OPENAI_API_KEY env var or in Settings
- Empty or incomplete responses: Check the MASTER_PROMPT format
- Slow processing: API calls typically take 3-10 seconds per ticket
"""

import json
import os
from openai import OpenAI
from typing import Dict, Any, Optional

# ============================================================================
# MASTER PROMPT
# ============================================================================
# This prompt instructs the AI how to analyze and respond to support tickets.
# It's carefully crafted to ensure consistent, professional, and safe outputs.
#
# Key sections:
# 1. Role & Identity: Establishes the AI's persona
# 2. Core Tasks: Step-by-step instructions for analysis
# 3. Email Tone & Style: Ensures professional communication
# 4. Output Format: Strict JSON structure for reliable parsing
# 5. Security Rules: Prevents AI from requesting sensitive info

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
    """
    Get the OpenAI API key from database settings or environment variable.
    
    The function checks in this order:
    1. Settings table in database (if db session provided)
    2. OPENAI_API_KEY environment variable
    
    Args:
        db: Optional SQLAlchemy database session
        
    Returns:
        The API key string if found, None otherwise
        
    TROUBLESHOOTING:
    - Key in database takes priority over environment variable
    - If key is invalid, OpenAI will return authentication errors
    """
    # First, try to get from database settings (user-configured)
    if db:
        from app.models import Settings
        setting = db.query(Settings).filter(Settings.key == "openai_api_key").first()
        if setting and setting.value:
            return setting.value
    
    # Fall back to environment variable
    return os.environ.get("OPENAI_API_KEY")


def process_ticket(
    ticket_id: int,
    sender_email: str,
    subject: str,
    body: str,
    received_at: str,
    db=None
) -> Optional[Dict[str, Any]]:
    """
    Process a support ticket using OpenAI's API.
    
    This function sends the ticket details to OpenAI and receives a structured
    response containing:
    - Category: Classification of the issue type
    - Urgency: Priority level (Low/Medium/High)
    - Summary: Brief description of the customer's issue
    - Fix Steps: Suggested troubleshooting steps for the agent
    - Draft Response: AI-generated reply for human review
    
    Args:
        ticket_id: Unique identifier for the ticket
        sender_email: Customer's email address
        subject: Email subject line
        body: Full email body content
        received_at: Timestamp when email was received
        db: Optional database session for settings lookup
        
    Returns:
        Dictionary with AI analysis results, or None if processing failed
        
        Example return value:
        {
            "category": "Technical",
            "urgency": "High",
            "summary": "Customer reports login page not loading",
            "fix_steps": "1. Clear browser cache\\n2. Try incognito mode...",
            "draft_response": "Good day,\\n\\nThank you for contacting..."
        }
        
    TROUBLESHOOTING:
    - Returns None if API key is missing
    - Check console logs for specific error messages
    - Network errors will also return None
    """
    # Get API key from settings or environment
    api_key = get_openai_key(db)
    
    if not api_key:
        print("OpenAI API key not configured")
        return None
    
    try:
        # Create OpenAI client with the API key
        client = OpenAI(api_key=api_key)
        
        # Format the ticket details for the AI
        user_message = f"""
Ticket ID: {ticket_id}
Sender Email: {sender_email}
Subject: {subject}
Received: {received_at}

Email Body:
{body}
"""
        
        # Call OpenAI API
        # Note: Using GPT-5 for best results (released August 2025)
        # the newest OpenAI model is "gpt-5" which was released August 7, 2025.
        # do not change this unless explicitly requested by the user
        response = client.chat.completions.create(
            model="gpt-5",
            messages=[
                {"role": "system", "content": MASTER_PROMPT},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"},  # Ensures valid JSON output
            max_completion_tokens=2048,  # Limit response length
        )
        
        # Parse the JSON response from the AI
        result_text = response.choices[0].message.content
        result = json.loads(result_text)
        
        # Map the AI response to our expected format
        return {
            "category": result.get("category", "Other"),
            "urgency": result.get("urgency", "Medium"),
            "summary": result.get("summary", ""),
            "fix_steps": result.get("fix_steps", ""),
            "draft_response": result.get("response", ""),
        }
    except Exception as e:
        # Log the error for debugging
        print(f"AI Processing Error: {e}")
        return None
