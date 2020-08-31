import { EntityRepository, Repository } from 'typeorm';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public async getBalance(): Promise<Balance> {
    const transactions = await this.find(); // já que estamos dentro do repository de Transactions, a gente pode utilizar o "this" para referenciar esse repository de transactions e com isso utilizar o find para retornar as transactions
    const { income, outcome } = transactions.reduce(
      (accumulator: Balance, transaction: Transaction) => {
        switch (transaction.type) {
          case 'income':
            accumulator.income += Number(transaction.value);
            break;
          case 'outcome':
            accumulator.outcome += Number(transaction.value);
            break;
          default:
            break;
        }
        return accumulator;
      },
      {
        income: 0,
        outcome: 0,
        total: 0,
      },
    );
    const total = income - outcome;

    return { income, outcome, total };
  }

  public async findCategory(category_id: string): Promise<Category | null> {
    const findCategory = await this.findOne({
      where: { category_id },
    });

    return findCategory || null;
  }
}

export default TransactionsRepository;
