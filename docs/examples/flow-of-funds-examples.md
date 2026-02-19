# FinFlow - Flow of Funds Example Pack

Date: 2026-02-19

## Example 1 - Card Program Authorization to Settlement (T+1)

### Participants
- Cardholder
- Issuer Program
- Processor
- Card Network
- Sponsor Bank
- Settlement Account

### Flow
1. Cardholder initiates purchase for USD 120.00.
2. Merchant acquirer requests authorization via network.
3. Issuer Program approves and places hold for USD 120.00.
4. Processor records event and prepares clearing file.
5. Network clears transaction end of day.
6. Sponsor Bank settles net funds on T+1 to settlement account.

### Controls
- KYC/KYB passed before card issuance.
- Velocity and AML rules checked pre-clearing.
- Daily reconciliation between processor ledger and bank settlement report.

---

## Example 2 - Marketplace Split Payout (Platform + Seller)

### Participants
- Buyer
- Platform Wallet
- Splitter Engine
- Seller FBO Account
- Platform Revenue Account
- Payout Rail (ACH)

### Flow
1. Buyer pays USD 250.00 to platform checkout.
2. Funds land in platform wallet.
3. Splitter applies configured rule:
   - Seller share: 92% (USD 230.00)
   - Platform fee: 8% (USD 20.00)
4. Seller share routed to Seller FBO Account.
5. Platform fee routed to Platform Revenue Account.
6. ACH payout batch submitted at cutoff time.

### Controls
- Split rules versioned and approval-gated.
- Negative balance prevention on seller account.
- Payout retries with idempotency key.

---

## Example 3 - Cross-Border Remittance (USD to MXN)

### Participants
- Sender
- US Funding Account
- FX Engine
- Compliance (KYC + Sanctions)
- Correspondent Bank
- Recipient Bank Account (MXN)

### Flow
1. Sender funds USD 500.00 from US account.
2. Compliance checks transaction and sender profile.
3. FX Engine quotes USD/MXN and locks rate.
4. Net amount after fee converted to MXN.
5. Correspondent bank receives payment instruction.
6. Recipient account credited in MXN.
7. Confirmation webhook sent to sender app.

### Controls
- Sanctions screening before FX lock.
- Quote expiry and slippage guardrails.
- End-to-end trace ID across rails and webhook.

---

## Suggested JSON Fields for FinFlow Nodes

- `name`
- `type`
- `notes`
- `accountType`
- `custodyModel`
- `rail`
- `stage`
- `kycRequired`
- `amlMode`

## Suggested JSON Fields for FinFlow Edges

- `label`
- `pathType` (`bezier` or `orthogonal`)
- `rail`
- `settlementWindow`
- `notes`
