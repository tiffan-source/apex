import { TestBed } from '@angular/core/testing';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { A11yProviders } from './a11y.provider';

describe('A11yProviders', () => {
  it("donne au LiveAnnouncer une zone masquée par e-masque, toujours stylée par Empreinte", async () => {
    TestBed.configureTestingModule({ providers: [...A11yProviders] });
    const announcer = TestBed.inject(LiveAnnouncer);

    await announcer.announce('Un pas de plus.');

    const zones = Array.from(document.body.querySelectorAll<HTMLElement>('.e-masque[aria-live]'));
    expect(zones).toHaveLength(1);
    expect(zones[0].textContent).toBe('Un pas de plus.');
    expect(zones[0].getAttribute('aria-atomic')).toBe('true');
    expect(document.body.querySelector('.cdk-live-announcer-element')).toBeNull();
  });
});
