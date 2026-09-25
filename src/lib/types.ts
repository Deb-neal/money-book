export type TxType = "expense" | "income" | "saving";

export interface Transaction {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  type: TxType;
  category: string;
  title: string;
  amount: number;
  account: string | null;
  memo: string | null;
  recurring_id: string | null;
}

export type NewTransaction = Omit<Transaction, "id">;

export interface Recurring {
  id: string;
  title: string;
  type: TxType;
  category: string;
  amount: number;
  day_of_month: number;
  account: string | null;
  memo: string | null;
  active: boolean;
}

export type NewRecurring = Omit<Recurring, "id">;
