import { getCustomRepository, getRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionRepository);
    const categoriesRepository = getRepository(Category);
    const contactsReadStream = fs.createReadStream(filePath);

    const parsers = csvParse({
      from_line: 2,
    });

    const parseCSV = contactsReadStream.pipe(parsers);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );
      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });
    await new Promise(resolve => parseCSV.on('end', resolve)); // criar uma promise que verifica se o parseCSV emitiu um evento chamado "end", pois sem isso, se a gente desse um console.log no parseCSV, iria aparecer algo vazio, ele é assincrono. Portanto quando o evento end for emitido, o parseCSV.on vai retornar o que ele devia fazer.

    // o método in verifica se existe determinada coisa no banco de dados. Nesse caso, vai verificar se existe alguma categoria a partir do title dentro do array de categories
    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    // retornando apenas os titles das categorias já existentes no banco de dados
    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    // passando um filtro nas categorias. No caso aqui eu estou dando um include apenas a categorias que não tem o title existente dentro do banco de dados
    // estou tirando também titles repetidos no segundo filter. o indexOf retorna o index em que o valor passado como parametro foi encontrado, se ele foi encontrado eu faço a filtragem com o === index. No caso o self é o array de categorias. O index é o index atual, e o indexOf com o value sendo passado vai achar o indice em que o valor que foi passado está armazenado, aí é feita essa comparação -> acha o indice do valor com o indexOf e vai sendo feita a comparação com o indice atual(index), se achar valores iguais, o filtro retira.
    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    // pq um map no create? Pois podem ser várias categorias ao memso tempo, e portanto é necessário utilizar o map para ir adicionando todas de vez
    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories]; // todas as categorias aqui nessa variável. Utilizando o ... eu copio as novas categorias que foram criadas e também as já existentes.

    // aquele find ali na finalCategories é pra ter certeza que eu vou adicionar no campo categoria da transacation apenas as categorias que tem o mesmo title da category da transaction que está sendo passada.
    const createdTransactions = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionRepository.save(createdTransactions);

    await fs.promises.unlink(filePath); // excluir o arquivo depois que foi tudo feito

    return createdTransactions;
  }
}

export default ImportTransactionsService;
