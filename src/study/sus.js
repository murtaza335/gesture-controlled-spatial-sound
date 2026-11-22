// @ts-check
/** The standard System Usability Scale items (1 = strongly disagree … 5 = strongly agree). */
export const SUS_ITEMS = [
  'I think that I would like to use this system frequently.',
  'I found the system unnecessarily complex.',
  'I thought the system was easy to use.',
  'I think that I would need the support of a technical person to be able to use this system.',
  'I found the various functions in this system were well integrated.',
  'I thought there was too much inconsistency in this system.',
  'I would imagine that most people would learn to use this system very quickly.',
  'I found the system very cumbersome to use.',
  'I felt very confident using the system.',
  'I needed to learn a lot of things before I could get going with this system.',
];

/** Odd items: score − 1; even items: 5 − score; sum × 2.5 → 0..100. */
export function susScore(answers) {
  if (answers.length !== 10 || answers.some((a) => !(a >= 1 && a <= 5))) return NaN;
  let sum = 0;
  answers.forEach((a, i) => {
    sum += i % 2 === 0 ? a - 1 : 5 - a;
  });
  return sum * 2.5;
}
