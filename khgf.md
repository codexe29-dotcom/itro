In ITRO, the payment gateway architecture is already built around Razorpay (see payments.ts and payments.ts).

Here is the exact breakdown of details you need from your client to integrate and go live with payments:                                                                                                                                                                   
──────
### 1. Technical Credentials (Essential for the App)

Your client will need to generate these from their Razorpay Dashboard https://dashboard.razorpay.com/ (Settings → API Keys):

• Razorpay Key ID:                                                                                                                                                                                                                                                         
• For Staging/Testing: Starts with rzp_test_...                                                                                                                                                                                                                        
• For Production/Live: Starts with rzp_live_...                                                                                                                                                                                                                        
• Razorpay Key Secret:                                                                                                                                                                                                                                                     
• Generated once alongside the Key ID (must be kept confidential).                                                                                                                                                                                                     
• Webhook Secret (Recommended for production):                                                                                                                                                                                                                             
• Configured in Settings → Webhooks so your backend can receive asynchronous payment confirmation (e.g., when a user pays via UPI/netbanking and closes the tab before returning to your app).


│ Note: In ITRO, these keys are not committed to Git or stored in plain .env. As detailed in DEPLOYMENT.md:93, a Super Admin enters them directly via the UI in Platform → Integrations (/platform/integrations).                                                          
──────
### 2. Merchant Account & KYC Status (Client Prerequisite)

Razorpay requires an activated business account before generating live keys:

• Approved Razorpay KYC: The client's business entity must have completed verification (Company PAN, Certificate of Incorporation / Partnership Deed / GSTIN).                                                                                                             
• Linked Settlement Bank Account: The bank account where Razorpay will deposit incoming customer payments.                                                                                                                                                                 
──────
### 3. Business & Invoicing Details

Because ITRO generates tax invoices on successful checkout:

• Legal Business Name: Exact entity name for billing.                                                                                                                                                                                                                      
• Registered Business Address: For GST invoice headers.                                                                                                                                                                                                                    
• GSTIN (GST Number): Needed for B2B tax compliance and SAC codes (default tax rate in config is 18% GST).                                                                                                                                                                 
• Payment Flow / Marketplace Settlement Model:                                                                                                                                                                                                                             
• Standard Aggregator Model (Current Default): ITRO collects the full payment; payouts to partner research labs/institutions are handled separately.                                                                                                                   
• Split / Route Model: If they expect Razorpay to automatically split funds directly to lab bank accounts, they must activate Razorpay Route on their merchant account.

──────
### 4. Mandatory Website Compliance (Razorpay Requirement)

Razorpay will review the public website before enabling live payments. Make sure the client signs off on these live public pages:

• Terms & Conditions                                                                                                                                                                                                                                                       
• Privacy Policy                                                                                                                                                                                                                                                           
• Refund, Return & Cancellation Policy (specifying testing order cancellation rules)                                                                                                                                                                                       
• Contact Us (displaying a real support email, physical address, and grievance officer phone)                                                                                                                                                                              
──────
### Copy-Paste Checklist to Send to Your Client

    Hi [Client Name],                                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                                                             
    To set up payment processing for ITRO, please provide the following details from your Razorpay account:                                                                                                                                                                  
                                                                                                                                                                                                                                                                             
    1. API Credentials (from Razorpay Dashboard > Account & Settings > API Keys):                                                                                                                                                                                            
       - Key ID (rzp_test_... for testing, rzp_live_... for live)                                                                                                                                                                                                            
       - Key Secret                                                                                                                                                                                                                                                          
                                                                                                                                                                                                                                                                             
    2. Business & Invoicing Info:                                                                                                                                                                                                                                            
       - Official Registered Business Name & Address                                                                                                                                                                                                                         
       - GSTIN Number                                                                                                                                                                                                                                                        
       - Support contact details to display on customer invoices and receipts                                                                                                                                                                                                
                                                                                                                                                                                                                                                                             
    3. Razorpay Account Status:                                                                                                                                                                                                                                              
       - Confirm KYC is fully approved and settlement bank account is active.                                                                                                                                                                                                
       - Confirm payment modes needed (UPI, Cards, Net Banking, Corporate Cards).                                                                                                                                                                                            
       - If laboratory payouts should be split automatically via Razorpay, confirm if Razorpay Route is enabled.                                                                                                                                                             
                                                                                                                                                                                                                                                                             
    Thank you!                                                                                                                                                                                                                                                               
──────                                                                                                                                                                                                                                                                     
Whenever you're ready, we can continue covering all the other tasks to make the platform deployment-ready (database migration checks, environment configuration, storage setup, and test verification). Let me know what step you'd like to tackle first!                  





Here is a ready-to-send email/message for your client, followed by an objective breakdown of the security standards regarding storing and toggling API keys in the database/UI.                                                                                            
──────
### Part 1: Ready-to-Send Message / Email to Your Client

Subject: Request for Razorpay Integration Details & Merchant Setup — ITRO Platform

     Hi [Client Name],                                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                                                              
     We are currently finalizing the checkout and billing module for the ITRO platform. To enable online customer payments (UPI, Cards, Net Banking) and automated GST invoicing, we need a few details to link your Razorpay merchant account.                               
                                                                                                                                                                                                                                                                              
     Depending on your current setup, please review the relevant section below:                                                                                                                                                                                               
     ──────                                                                                                                                                                                                                                                                   
     ### If you already have an active Razorpay Account:                                                                                                                                                                                                                      
                                                                                                                                                                                                                                                                              
     Please log in to your Razorpay Dashboard https://dashboard.razorpay.com/ and provide:                                                                                                                                                                                    
                                                                                                                                                                                                                                                                              
     1. API Keys:                                                                                                                                                                                                                                                             
         • Go to Account & Settings → API Keys → Generate Key.                                                                                                                                                                                                                
         • Key ID (e.g., rzp_live_... for production or rzp_test_... for testing).                                                                                                                                                                                            
         • Key Secret (Generated once alongside the Key ID).                                                                                                                                                                                                                  
     2. Business Details for Invoice Generation:                                                                                                                                                                                                                              
         • Legal Entity Name (as registered on GST).                                                                                                                                                                                                                          
         • Registered Business Address.                                                                                                                                                                                                                                       
         • GSTIN (GST Number).                                                                                                                                                                                                                                                
         • Support Email & Phone Number (for customer transaction receipts).                                                                                                                                                                                                  
                                                                                                                                                                                                                                                                              
                                                                                                                                                                                                                                                                              
     (Security Note: Please share the Key Secret over a secure channel such as a one-time secret link, Bitwarden/1Password, or enter it directly into the platform's Admin Integrations panel).                                                                               
     ──────                                                                                                                                                                                                                                                                   
     ### If you do NOT have a Razorpay Account yet:                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                              
      You will need to create a Razorpay merchant account. Setup is free:                                                                                                                                                                                                      
                                                                                                                                                                                                                                                                              
     1. Sign up at razorpay.com https://razorpay.com/ using your official company email.                                                                                                                                                                                      
     2. Complete KYC Verification: Razorpay will ask for:                                                                                                                                                                                                                     
         • Business Type (Proprietorship, LLP, Pvt Ltd, etc.).                                                                                                                                                                                                                
         • Company PAN & GST Certificate.                                                                                                                                                                                                                                     
         • Linked Settlement Bank Account (where your payouts will be deposited).                                                                                                                                                                                             
         • Authorized Signatory PAN & Aadhaar.                                                                                                                                                                                                                                
     3. Mandatory Website Links: Razorpay checks your domain before activating live payments. We have already prepared the platform with standard pages for:                                                                                                                  
         • Terms & Conditions, Privacy Policy, Cancellation/Refund Policy, and Contact Us.                                                                                                                                                                                    
                                                                                                                                                                                                                                                                              
                                                                                                                                                                                                                                                                              
     │ Note: While your account activation is being processed (typically 2–4 business days), you can generate Test API Keys (rzp_test_...) immediately upon sign-up so we can test the entire checkout flow without delay.                                                    
                                                                                                                                                                                                                                                                              
     Please let us know if you need any assistance with the registration or key generation.                                                                                                                                                                                   
                                                                                                                                                                                                                                                                              
     Best regards,                                                                                                                                                                                                                                                            
     [Your Name / Team]                                                                                                                                                                                                                                                       
──────
### Part 2: Is Toggling and Storing API Keys in the UI Secure?

Your intuition is spot on. In the current codebase, the approach was built for convenience during onboarding/demo stages, but it has definite gaps when measured against strict production security standards (such as PCI-DSS, OWASP, and SOC 2).

Here is an honest breakdown of where it stands and what should be hardened:

#### 1. What ITRO Does Right (Current Defenses)

• Access Control (RBAC): Only users with the SUPER_ADMIN role can access or patch /platform/integrations.                                                                                                                                                                  
• Masked Secrets (Write-Only): In server/src/routes/platform.ts:39, the razorpayKeySecret is never sent back over the API to the browser. The frontend only receives hasRazorpaySecret: true/false.                                                                        
• Audit Logging: Any update to keys or toggles logs an entry to the AuditLog table with the user ID and timestamp.

#### 2. Where the Security Gaps Are (Why it's not enterprise-grade)

1. Plaintext Storage in the Database:                                                                                                                                                                                                                                      
   • The PlatformSetting table stores razorpayKeySecret as plaintext in PostgreSQL.                                                                                                                                                                                       
   • If an attacker gains read access to database backups, SQL dumps, or exploits a SQL/ORM vulnerability, the secret key is exposed.
2. The "Free Order" Bypass Risk:                                                                                                                                                                                                                                           
   • Currently, in server/src/routes/orders.ts:568, if someone toggles razorpayEnabled to false, calling /orders/:id/pay automatically marks the order as PAID.                                                                                                           
   • In a live environment, if a malicious actor or mistaken admin turns off the toggle, buyers could simulate orders and get confirmed lab services for free.
3. Configuration Drift:                                                                                                                                                                                                                                                    
   • Storing core infrastructure credentials in a database makes it easy for staging and production environments to accidentally share keys if a database dump is restored across environments.

──────
### Production Best Practices (How to Make it Fully Secure)

If you are deploying this for a live commercial client, here are the two recommended ways to handle it:

    ┌─────────────────────────────────────────────────────────────┐                                                                                                                                                                                                          
    │ Recommended Approaches for Live Production                  │                                                                                                                                                                                                          
    ├───────────────────────────────┬─────────────────────────────┤                                                                                                                                                                                                          
    │ Method A: Environment / Vault │ Method B: Encrypted DB Row  │                                                                                                                                                                                                          
    │ (Best Practice - 12 Factor)   │ (If UI config is required)  │                                                                                                                                                                                                          
    ├───────────────────────────────┼─────────────────────────────┤                                                                                                                                                                                                          
    │ Keys kept in server .env or   │ Stored in DB, but encrypted │                                                                                                                                                                                                          
    │ AWS/GCP Secret Manager.       │ with AES-256-GCM before     │                                                                                                                                                                                                          
    │ Immune to DB backup leaks.    │ saving, decrypted in-memory.│                                                                                                                                                                                                          
    └───────────────────────────────┴─────────────────────────────┘                                                                                                                                                                                                          

#### Production Action Items:

1. Move Secrets to Server Environment Variables:                                                                                                                                                                                                                           
   Keep the UI toggle for enabling/disabling the gateway, but load the actual keys from process.env.RAZORPAY_KEY_ID and process.env.RAZORPAY_KEY_SECRET. This adheres strictly to the 12-factor application standard.
2. Fix the Fallback Flow:                                                                                                                                                                                                                                                  
   When Razorpay is toggled OFF in production, do not mark orders as PAID. Instead, mark them as AWAITING_OFFLINE_PAYMENT (e.g. Bank Transfer / Purchase Order) and require an admin or lab manager to manually verify the bank UTR before approving the order.               

