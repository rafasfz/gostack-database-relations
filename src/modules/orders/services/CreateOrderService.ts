import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

interface IProductsMap {
  [key: string]: number;
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found.');
    }

    const productsCompleted = await this.productsRepository.findAllById(
      products,
    );

    if (products.length !== productsCompleted.length) {
      throw new AppError('Invalid product(s).');
    }

    const productsMap = products.reduce<IProductsMap>((obj, product) => {
      // eslint-disable-next-line no-param-reassign
      obj[product.id] = product.quantity;

      return obj;
    }, {});

    const isInvalidQuantity = productsCompleted.find(
      product => product.quantity < productsMap[product.id],
    );

    if (isInvalidQuantity) {
      throw new AppError('Invalid quantity');
    }

    await this.productsRepository.updateQuantity(products);

    const parsedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsCompleted.find(
        productCompleted => productCompleted.id === product.id,
      )?.price as number,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: parsedProducts,
    });

    return order;
  }
}

export default CreateOrderService;
