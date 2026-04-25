// Design tokens — warm editorial palette from the Ghar Kharcha design system
export const T = {
  paper:          '#F3EADB',
  paper2:         '#EADFCA',
  ink:            '#1F1A15',
  ink2:           '#544A3E',
  ink3:           '#8A7E6E',
  rule:           'rgba(31,26,21,0.09)',
  terracotta:     '#C85C3C',
  terracottaInk:  '#7A2E17',
  haldi:          '#E3A82E',
  moss:           '#6F7A3E',
  chai:           '#A86B3C',
  card:           '#FBF5E8',
  cardAlt:        '#F7EDD8',
} as const;

export const FONTS = {
  serif:       'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifBold:   'Fraunces_600SemiBold',
  serifBoldItalic: 'Fraunces_600SemiBold_Italic',
  sans:        'Inter_400Regular',
  sansMedium:  'Inter_500Medium',
  sansSemiBold:'Inter_600SemiBold',
} as const;

export const shadowCard = {
  shadowColor:  '#1F1A15',
  shadowOpacity: 0.1,
  shadowRadius:  24,
  shadowOffset:  { width: 0, height: 8 },
  elevation: 3,
} as const;

export const shadowHero = {
  shadowColor:  '#1F1A15',
  shadowOpacity: 0.2,
  shadowRadius:  40,
  shadowOffset:  { width: 0, height: 18 },
  elevation: 8,
} as const;
