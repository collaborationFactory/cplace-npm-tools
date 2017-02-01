import * as Chai from "chai";
import {Arithmetic} from "../src/index";
/**
 * Test for Calculator
 */
describe("Calculator", () => {
    it("#add should add two numbers", async(done) => {
        const calculator = new Arithmetic.Calculator();
        const answer = calculator.add(1, 3);
        Chai.expect(answer).to.be.equal(4);
        done();
    });
});
