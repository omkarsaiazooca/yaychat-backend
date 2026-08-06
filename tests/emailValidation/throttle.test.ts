import assert from "assert";
import { DomainThrottler } from "../../helpers/emailValidation/throttle";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("DomainThrottler", () => {
  it("caps concurrent runs per domain", async () => {
    const throttler = new DomainThrottler(2, 0);
    let inFlight = 0;
    let maxInFlight = 0;

    const task = () =>
      throttler.run("gmail.com", async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await sleep(30);
        inFlight -= 1;
      });

    await Promise.all([task(), task(), task(), task(), task()]);
    assert.strictEqual(maxInFlight, 2, "no more than 2 concurrent connections per domain");
  });

  it("enforces a minimum delay between successive connections to the same domain", async () => {
    const throttler = new DomainThrottler(1, 60);
    const starts: number[] = [];
    const task = () =>
      throttler.run("outlook.com", async () => {
        starts.push(Date.now());
        await sleep(5);
      });

    await task();
    await task();
    assert.ok(
      starts[1] - starts[0] >= 55,
      `expected >=55ms between connections, got ${starts[1] - starts[0]}ms`
    );
  });

  it("throttles domains independently", async () => {
    const throttler = new DomainThrottler(1, 0);
    let concurrent = 0;
    let maxConcurrent = 0;
    const task = (domain: string) =>
      throttler.run(domain, async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await sleep(20);
        concurrent -= 1;
      });
    // Different domains should be allowed to run at the same time.
    await Promise.all([task("a.com"), task("b.com"), task("c.com")]);
    assert.strictEqual(maxConcurrent, 3);
  });
});
