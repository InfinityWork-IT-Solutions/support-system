from sqlalchemy.orm import Session
from app.models import Template, KnowledgeArticle, Category

def init_default_data(db: Session):
    """
    Initialize the database with default templates and knowledge base articles.
    This ensures that the system always has some example content for each category.
    """
    print("[Init] Checking for default templates and knowledge articles...")
    
    # --- Templates ---
    templates = [
        {
            "name": "Standard Billing Response",
            "category": Category.BILLING.value,
            "content": "Good day,\n\nThank you for contacting our Billing Department regarding your recent inquiry.\n\nWe have received your query about your invoice/payment.\n\n[Specific details will be added here based on the user's issue]\n\nIf you have any further questions, please let us know.\n\nBest regards,\nInfinityWork Support Team"
        },
        {
            "name": "Technical Issue Acknowledgment",
            "category": Category.TECHNICAL.value,
            "content": "Good day,\n\nWe have received your report regarding the technical issue you are experiencing.\n\nOur engineering team has been notified and is currently investigating the matter. We may need some additional information to isolate the problem.\n\nCould you please provide:\n1. Screenshots of the error\n2. Steps to reproduce the issue\n\nWe will update you as soon as we have a resolution.\n\nBest regards,\nInfinityWork Support Team"
        },
        {
            "name": "Password Reset Instructions",
            "category": Category.LOGIN_ACCESS.value,
            "content": "Good day,\n\nWe understand you are having trouble determining your login credentials.\n\nTo reset your password, please follow these steps:\n1. Go to the login page.\n2. Click on 'Forgot Password'.\n3. Enter your registered email address.\n4. Follow the link sent to your email.\n\nIf you do not receive the email within 5 minutes, please check your spam folder.\n\nBest regards,\nInfinityWork Support Team"
        },
        {
            "name": "Feature Request Review",
            "category": Category.FEATURE_REQUEST.value,
            "content": "Good day,\n\nThank you for your valuable feedback and suggestion.\n\nWe have logged your feature request for our product team to review. While we cannot guarantee immediate implementation, we prioritize features based on user demand and strategic alignment.\n\nWe appreciate you helping us improve our product.\n\nBest regards,\nInfinityWork Support Team"
        },
        {
            "name": "General Inquiry Response",
            "category": Category.GENERAL_INQUIRY.value,
            "content": "Good day,\n\nThank you for reaching out to InfinityWork IT Solutions.\n\nIn response to your inquiry:\n\n[Provide specific answer here]\n\nWe hope this information helps. Please let us know if you need anything else.\n\nBest regards,\nInfinityWork Support Team"
        },
         {
            "name": "Standard Investigation",
            "category": Category.OTHER.value,
            "content": "Good day,\n\nThank you for your email.\n\nWe are currently looking into the matter you raised. We will get back to you shortly with more information.\n\nThank you for your patience.\n\nBest regards,\nInfinityWork Support Team"
        }
    ]

    new_templates = 0
    for data in templates:
        exists = db.query(Template).filter(Template.name == data["name"]).first()
        if not exists:
            db.add(Template(**data))
            new_templates += 1

    # --- Knowledge Base Articles ---
    articles = [
        {
            "title": "How to update your payment method",
            "category": Category.BILLING.value,
            "keywords": "billing, payment, credit card, update",
            "content": "# Updating Payment Method\n\nTo update your payment method:\n1. Log in to your account.\n2. Navigate to **Settings > Billing**.\n3. Click on **Update Payment Method**.\n4. Enter your new card details and save.\n\nNote: Changes are immediate."
        },
        {
            "title": "Troubleshooting Connection Issues",
            "category": Category.TECHNICAL.value,
            "keywords": "connection, network, offline, error",
            "content": "# Connection Troubleshooting\n\nIf you are experiencing connection issues:\n\n1. **Check your internet connection**: Ensure you can access other websites.\n2. **Clear Cache**: Clear your browser cache and cookies.\n3. **Restart**: Try restarting your browser or device.\n4. **Status Page**: Check our status page for any ongoing outages."
        },
        {
            "title": "Resetting Your Password",
            "category": Category.LOGIN_ACCESS.value,
            "keywords": "password, reset, login, locked",
            "content": "# Password Reset\n\nIf you forgot your password:\n\n1. Go to the login screen.\n2. Click the **Forgot Password** link.\n3. Enter your email address.\n4. Check your email for a reset link.\n\n**Note**: The link expires in 24 hours."
        },
        {
            "title": "How We Prioritize Features",
            "category": Category.FEATURE_REQUEST.value,
            "keywords": "roadmap, features, request, planning",
            "content": "# Feature Prioritization\n\nWe value customer feedback. Our process for new features is:\n\n1. **Collection**: All requests are logged.\n2. **Review**: Product team reviews requests weekly.\n3. **Planning**: High-impact features are added to our roadmap.\n4. **Development**: Features are scheduled for development cycles."
        },
        {
            "title": "Support Hours and Contact Info",
            "category": Category.GENERAL_INQUIRY.value,
            "keywords": "hours, contact, phone, email",
            "content": "# Support Hours\n\nOur support team is available:\n\n- **Monday - Friday**: 8:00 AM - 6:00 PM (SAST)\n- **Saturday**: 9:00 AM - 1:00 PM (SAST)\n- **Sunday**: Closed\n\nFor critical issues outside these hours, please use the emergency contact number provided in your SLA."
        },
         {
            "title": "General Troubleshooting Steps",
            "category": Category.OTHER.value,
            "keywords": "troubleshoot, general, error, bug",
            "content": "# General Troubleshooting\n\nBefore contacting support, try these general steps:\n\n1. **Refresh the page**: Often clears temporary glitches.\n2. **Log out and back in**: Refreshes your session.\n3. **Update Browser**: Ensure you are using the latest version of Chrome, Firefox, or Edge."
        }
    ]

    new_articles = 0
    for data in articles:
        exists = db.query(KnowledgeArticle).filter(KnowledgeArticle.title == data["title"]).first()
        if not exists:
            db.add(KnowledgeArticle(**data))
            new_articles += 1

    if new_templates > 0 or new_articles > 0:
        db.commit()
        print(f"[Init] Added {new_templates} templates and {new_articles} knowledge articles.")
    else:
        print("[Init] Default data already exists.")
