import { ReleaseNumber } from "../../commands/flow/ReleaseNumber";

test('can sort releases', () => {
    let releases = [];
    releases.push(ReleaseNumber.parse('main'));
    releases.push(ReleaseNumber.parse('master'));
    releases.push(ReleaseNumber.parse('5.17'));
    releases.push(ReleaseNumber.parse('5.10'));
    releases.push(ReleaseNumber.parse('22.3'));
    releases.push(ReleaseNumber.parse('22.4'));

    releases =  Array.from(releases)
        .sort((r1, r2) => {
            return r1.compareTo(r2);
        });

    expect(releases).toHaveLength(6);
    expect(releases[0].toString()).toBe('5.10.0')
    expect(releases[1].toString()).toBe('5.17.0')
    expect(releases[2].toString()).toBe('22.3.0')
    expect(releases[3].toString()).toBe('22.4.0')
    expect(releases[4].toString()).toBe('default')
    expect(releases[5].toString()).toBe('default')
});
