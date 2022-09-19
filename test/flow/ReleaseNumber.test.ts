import { ReleaseNumber } from '../../src/commands/flow/ReleaseNumber';

test('can parse release', () => {
    expect(ReleaseNumber.parse('4.57.12').toString()).toBe('4.57.12')
    expect(ReleaseNumber.parse('5.20').toString()).toBe('5.20.0')
});

test('can find predecessor release', () => {
    expect(ReleaseNumber.parse('4.57.12').getMajorOrMinorPredecessorRelease().toString()).toBe(ReleaseNumber.parse('4.56').toString())
    expect(ReleaseNumber.parse('5.0').getMajorOrMinorPredecessorRelease().toString()).toBe(ReleaseNumber.parse('4.57').toString())
    expect(ReleaseNumber.parse('5.20').getMajorOrMinorPredecessorRelease().toString()).toBe(ReleaseNumber.parse('5.19').toString())
    expect(ReleaseNumber.parse('22.2').getMajorOrMinorPredecessorRelease().toString()).toBe(ReleaseNumber.parse('5.20').toString())
    expect(ReleaseNumber.parse('22.3').getMajorOrMinorPredecessorRelease().toString()).toBe(ReleaseNumber.parse('22.2').toString())
    expect(ReleaseNumber.parse('23.2').getMajorOrMinorPredecessorRelease().toString()).toBe(ReleaseNumber.parse('23.1').toString())
    expect(ReleaseNumber.parse('23.1').getMajorOrMinorPredecessorRelease().toString()).toBe(ReleaseNumber.parse('22.4').toString())
    expect(ReleaseNumber.parse('23.4').getMajorOrMinorPredecessorRelease().toString()).toBe(ReleaseNumber.parse('23.3').toString())
    expect(ReleaseNumber.parse('24.1').getMajorOrMinorPredecessorRelease().toString()).toBe(ReleaseNumber.parse('23.4').toString())
    expect(ReleaseNumber.parse('32.1').getMajorOrMinorPredecessorRelease().toString()).toBe(ReleaseNumber.parse('31.4').toString())
});

test('can sort releases', () => {
    let releases = [];
    releases.push(ReleaseNumber.parse('main'));
    releases.push(ReleaseNumber.parse('master'));
    releases.push(ReleaseNumber.parse('5.17'));
    releases.push(ReleaseNumber.parse('5.10'));
    releases.push(ReleaseNumber.parse('22.3'));
    releases.push(ReleaseNumber.parse('22.4'));

    releases = Array.from(releases)
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

test('can detect default branches', () => {
    expect(ReleaseNumber.isDefaultBranch('main')).toBe(true);
    expect(ReleaseNumber.isDefaultBranch('master')).toBe(true);
    expect(ReleaseNumber.isDefaultBranch('master', 'origin')).toBe(true);
    expect(ReleaseNumber.isDefaultBranch('main', 'origin')).toBe(true);
})
