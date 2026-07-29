CREATE TYPE "transaction_type" AS ENUM ('Deposit', 'Withdrawal', 'Lend Funds', 'Loan Payment');

CREATE TYPE "asset_symbol" AS ENUM ('XLM', 'USDC', 'BTC', 'ETH');

CREATE TYPE "transaction_status" AS ENUM ('Completed', 'Processing', 'Failed');

ALTER TABLE "transactions" ALTER COLUMN "type" SET DATA TYPE transaction_type USING "type"::transaction_type;

ALTER TABLE "transactions" ALTER COLUMN "asset" SET DATA TYPE asset_symbol USING "asset"::asset_symbol;

ALTER TABLE "transactions" ALTER COLUMN "status" SET DATA TYPE transaction_status USING "status"::transaction_status;
