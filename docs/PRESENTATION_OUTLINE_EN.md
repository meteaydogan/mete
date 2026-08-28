# Presentation Outline — DEPOM Customer Support Agent

> A draft for a typical 12–15 slide graduation project defense. Each item is a suggested slide; keep slide content brief (bullet points, not long paragraphs).

## 1. Cover
- Project name, student name, advisor name, department, date

## 2. Problem and Motivation
- Repetitive tasks and human resource cost in customer support
- Risks of full automation (wrong refunds, fraud, loss of trust)

## 3. Project Objective and Scope
- What is and isn't covered (out-of-scope items)

## 4. Original Contribution
- 2–3 distinguishing points of this project (from report section 1.3)

## 5. General Architecture (Visual)
- Add the flowchart diagram from `docs/PROJECT_REPORT_EN.md` as an image

## 6. Tool-Calling Flow
- User message → sentiment analysis → tool call → result card → response
- Show the sequence diagram (README.md)

## 7. Security Design
- Identity verification, sessions, rate limiting, audit log
- "Why it matters": impersonation and fraud examples

## 8. Key Business Rules
- 14-day return window, duplicate request blocking, risk scoring

## 9. Live Demo (1)
- Successful shipment tracking + return confirmation flow

## 10. Live Demo (2)
- Suspicious/angry customer scenario → automatic escalation → agent panel

## 11. Testing Approach and Results
- Unit test list, `npm test` output (fill in with real numbers)

## 12. Challenges Faced
- [2–3 points from your own experience: e.g. "designing the confirmation flow for irreversible actions", "session security"]

## 13. Known Limitations and Future Work
- Summary from report section 6

## 14. Conclusion
- One-paragraph closing statement

## 15. Questions
- "Questions?" slide

---

### Notes for the Live Demo Rehearsal
- Before the live demo, make sure `npm start` is running and `http://localhost:3000` is open; tell the committee you can fall back to the API-free Demo engine if internet access fails.
- Likely question: "Why didn't you use a real database?" → Prepare the answer from report section 6 / README "Known Limitations".
- Likely question: "Is this complex enough for a graduation project?" → Emphasize the number of architectural layers (client demo engine, backend proxy, sessions, persistence, security, testing).
