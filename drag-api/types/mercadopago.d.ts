declare module 'mercadopago' {
  export class MercadoPagoConfig {
    constructor(config: { accessToken: string });
  }

  export class Preference {
    constructor(config: MercadoPagoConfig);
    create(input: { body: any }): Promise<any>;
  }

  export class Payment {
    constructor(config: MercadoPagoConfig);
    get(input: { id: string }): Promise<any>;
  }
}
