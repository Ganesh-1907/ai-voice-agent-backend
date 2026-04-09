import { Injectable } from "@nestjs/common";

@Injectable()
export class PlansService {
  listPlans() {
    return [
      {
        code: "starter",
        priceInr: 999,
        includedCalls: 50,
        extraCallPriceInr: 20,
        estimatedProfitRangeInr: [250, 650],
      },
      {
        code: "growth",
        priceInr: 2999,
        includedCalls: 150,
        extraCallPriceInr: 15,
        estimatedProfitRangeInr: [750, 1900],
      },
      {
        code: "pro",
        priceInr: 9999,
        includedCalls: 500,
        extraCallPriceInr: 12,
        estimatedProfitRangeInr: [2500, 6500],
      },
    ];
  }
}
