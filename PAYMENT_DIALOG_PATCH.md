# OyaCheck — accessible payment review dialog patch

Patch scope: Only the optional Celo Sepolia sandbox browser confirmation UI and accurate source-inspection wording. It does NOT add mainnet spending or change the payment backend, quotes, receipts, voice, or evidence engine.

Changes:
- Replaces window.confirm with a branded native HTML dialog.
- Shows amount, token, network, 1-minute rental, inspected source and explicit confirmation.
- Cancel, Close and Escape never issue a payment request.
- Payment request occurs only after Approve is clicked; the quote expires and is validated before use.
- After successful trusted-source inspection, the scope statement correctly says the official advisory was opened and the submitted suspicious link was not opened.
- Adds 5 frontend safety regression tests.

Install:
1. Stop the app (Ctrl+C).
2. cd ~/Desktop/celo
3. cp -a official-link-agent "official-link-agent-backup-$(date +%Y%m%d-%H%M%S)"
4. unzip -o ~/Downloads/oyacheck-payment-dialog-patch.zip -d official-link-agent
5. cd official-link-agent
6. npm run check && npm test
7. Start as before (with your existing Groq key). Use BUY_BROWSER_SANDBOX=1 only for local sandbox testing.

Important: No new sandbox or mainnet payment is needed to verify this visual-only patch. To preview without paying, use the existing free quote, open the new payment-review dialog, and Cancel. The prior confirmed sandbox evidence remains valid.
