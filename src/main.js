
/**
 * Функция для расчёта выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  return purchase.sale_price * purchase.quantity * (1 - purchase.discount / 100);
}

/**
 * Функция для расчёта бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  let rate = 0;

  if (index === 0) {
    rate = 0.15;
  } else if (index === total - 1) {
    rate = 0;
  } else if (index === 1 || index === 2) {
    rate = 0.10;
  } else if (index === total - 2) {
    rate = 0.05;
  }

  return Number((seller.profit * rate).toFixed(2));
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  // Проверка входных данных
  if (!data || typeof data !== 'object') {
    throw new Error('Не переданы данные о продажах');
  }

  for (const key of ['sellers', 'products', 'purchase_records']) {
    if (!Array.isArray(data[key]) || data[key].length === 0) {
      throw new Error(`Раздел ${key} должен содержать непустой массив`);
    }
  }

  // Проверка наличия опций
  if (
    !options ||
    typeof options.calculateRevenue !== 'function' ||
    typeof options.calculateBonus !== 'function'
  ) {
    throw new Error(
      'Необходимо передать функции calculateRevenue и calculateBonus'
    );
  }

  // Индексация товаров для быстрого поиска
  const productsBySku = new Map(
    data.products.map(product => [product.sku, product])
  );

  // Подготовка статистики по продавцам
  const statsBySellerId = new Map(
    data.sellers.map(seller => [
      seller.id,
      {
        seller_id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        soldProducts: new Map()
      }
    ])
  );

  // Расчёт выручки и прибыли каждого продавца
  for (const receipt of data.purchase_records) {
    const stats = statsBySellerId.get(receipt.seller_id);

    if (!stats || !Array.isArray(receipt.items)) {
      throw new Error(
        `Некорректный чек: ${receipt.receipt_id || 'без номера'}`
      );
    }

    // Увеличение количества продаж
    stats.sales_count += 1;

    // Обработка товаров в чеке
    for (const item of receipt.items) {
      const product = productsBySku.get(item.sku);

      if (!product) {
        throw new Error(`Неизвестный товар: ${item.sku}`);
      }

      // Выручка по товару
      const revenue = options.calculateRevenue(item, product);

      // Закупочная стоимость
      const cost = product.purchase_price * item.quantity;

      // Общая выручка продавца
      stats.revenue += revenue;

      // Прибыль продавца
      stats.profit += revenue - cost;

      // Количество проданных единиц товара
      stats.soldProducts.set(
        item.sku,
        (stats.soldProducts.get(item.sku) || 0) + item.quantity
      );
    }
  }

  // Формирование рейтинга продавцов
  const rating = Array.from(statsBySellerId.values(), seller => ({
    seller_id: seller.seller_id,
    name: seller.name,

    // Округление денежных значений до двух знаков
    revenue: Number(seller.revenue.toFixed(2)),
    profit: Number(seller.profit.toFixed(2)),

    sales_count: seller.sales_count,

    // Десять самых продаваемых товаров
    top_products: Array.from(
      seller.soldProducts,
      ([sku, quantity]) => ({
        sku,
        quantity
      })
    )
      .sort((first, second) => second.quantity - first.quantity)
      .slice(0, 10)
  }));

  // Сортировка продавцов по убыванию прибыли
  rating.sort((first, second) => second.profit - first.profit);

  // Начисление премий и формирование итогового отчёта
  return rating.map((seller, index) => ({
    ...seller,
    bonus: options.calculateBonus(index, rating.length, seller)
  }));
}
