# Lending quote API

## Endpoint

`POST /api/quote`

## Request body

```json
{
  "type": "lend",
  "data": {
    "asset": "XLM",
    "amount": 1000,
    "interestRate": 10,
    "duration": 30
  }
}
```

- `type`: `"lend"` or `"borrow"`
- `data.amount`: positive number
- `data.interestRate`: positive number (percent)
- `data.duration`: optional days (defaults to 30 for borrow)

## Response

```json
{
  "result": {
    "totalEarnings": 8.22,
    "dailyEarnings": 0.27,
    "totalRepayment": 1010,
    "monthlyPayment": 1010
  }
}
```

Borrow responses include `monthlyPayment` and `totalRepayment`. Lend responses include `totalEarnings` and `dailyEarnings`.

## Errors

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid input for quote calculation."
  }
}
```

Shared calculation logic lives in `lib/lending/quote.ts` and is used by `InterestCalculator` and this route.
