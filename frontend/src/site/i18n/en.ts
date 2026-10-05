/**
 * English — эталонный словарь сайта: его структура и есть тип Dict, остальные языки обязаны её повторять
 * (порядок и число элементов в списках — тоже, тест сверяет). {name} — подстановка (i18n/index: fmt).
 * В заголовках '|' — место переноса без пробела (для китайского и японского, где пробелов нет).
 * Только то, что в игре уже есть; планы помечены как планы; никаких обещаний заработка и выдуманных цифр.
 */
export const en = {
  meta: {
    title: 'Meowgul — a cat universe inside Telegram',
    description:
      'Meowgul is a game inside Telegram: tap, collect characters, grow your account and climb ten leagues. Built to grow with its community.',
  },
  nav: {
    project: 'Project',
    gameplay: 'Gameplay',
    collection: 'Collection',
    airdrop: 'Airdrop',
    roadmap: 'Roadmap',
    community: 'Community',
    sections: 'Sections',
    menu: 'Menu',
    homeAria: 'Meowgul — home',
    language: 'Language',
  },
  cta: {
    play: 'Play',
    learn: 'About the project',
    checkProgress: 'Check progress',
    partner: 'Become a partner',
  },
  social: { telegram: 'Telegram', x: 'X', community: 'Community', soon: 'Soon', main: 'Main channel' },
  hero: {
    label: 'Telegram Mini App',
    title: 'Enter the world of Meowgul',
    lead: 'A living Telegram game where every tap, every upgrade and every discovery takes you deeper into a growing universe.',
    scroll: 'Scroll',
  },
  project: {
    label: 'The project',
    title: 'A world built one cat at a time',
    blocks: [
      {
        title: 'What it is',
        text: 'A game inside Telegram. Open it in one tap, no install: tap, build and collect cats with their own stories.',
      },
      {
        title: 'Why it exists',
        text: 'Most tap games are one screen and one number. Meowgul adds what makes you care: characters, a collection and progress that lasts.',
      },
      {
        title: 'What you get',
        text: 'Short sessions with real progress — income that grows while you are away, daily rewards, leagues and characters to collect.',
      },
      {
        title: 'Where it is going',
        text: 'More characters, community events and new game systems, added step by step as the world grows.',
      },
    ],
    facts: [
      { value: '1 tap', label: 'to start' },
      { value: '10', label: 'characters' },
      { value: '50', label: 'levels' },
      { value: '60', label: 'achievements' },
    ],
  },
  gameplay: {
    label: 'Gameplay',
    title: 'How it works',
    lead: 'One loop, five steps — and every day it takes you a little further.',
    loop: [
      {
        title: 'Play',
        text: 'Tap the cat to earn PAW.',
        detail: 'Each tap spends 1 energy · 5,000 energy, +3 per second',
      },
      {
        title: 'Collect',
        text: 'Characters, skins and tap effects.',
        detail: 'Rarity changes the look, never the economy',
      },
      {
        title: 'Grow',
        text: 'Upgrade assets, level up, climb leagues.',
        detail: '59 assets earn every hour — offline too, up to 3 h',
      },
      {
        title: 'Discover',
        text: 'Daily combo, Morse cipher and tasks.',
        detail: '60 achievements to unlock along the way',
      },
      {
        title: 'Return',
        text: 'A reward streak and income waiting for you.',
        detail: '10-day streak · new tasks every day',
      },
    ],
    boosts: [
      { title: 'Turbo', text: '×5 per tap for 60 s, no energy spent · 3 a day' },
      { title: 'Full energy', text: 'Refill to the top instantly · 6 a day' },
    ],
    energy: 'Energy',
    turboOn: 'Turbo · no energy',
    turbo: 'Turbo ×{x}',
    turboAria: 'Turbo: {left} of {total} left today',
    demo: 'Try it: tap the cat',
    tapHint: 'Tap the cat',
    noEnergy: 'No energy',
  },
  collection: {
    label: 'The collection',
    title: 'Every cat has a story',
    lead: 'From silent assassins to cosmic emperors — each character has a world, a rarity and a story. Swipe, tap or use the arrows.',
    rarity: 'Rarity',
    type: 'Type',
    power: 'Power',
    prev: 'Previous cat',
    next: 'Next cat',
    list: 'Cats',
    tiers: 'Rarity tiers',
    tierText: {
      COMMON: 'Where every collection starts.',
      RARE: 'Distinct looks, harder to find.',
      EPIC: 'Characters with their own worlds.',
      LEGENDARY: 'Icons of the universe.',
      MYTHIC: 'Almost beyond reach.',
    },
    note: 'Rarity is about looks, not power in the economy. Tap effects unlock as you level up.',
    explore: 'Open the collection →',
  },
  rarity: { COMMON: 'Common', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary', MYTHIC: 'Mythic' },
  cats: {
    stealth_assassin: {
      name: 'Stealth Assassin',
      subtitle: 'The Silent Hunter',
      world: 'Shadow District',
      story:
        'A master of precision and patience. Moving through the shadows, this legendary cat waits for the perfect moment to strike.',
      type: 'Assassin',
    },
    galaxy_emperor: {
      name: 'Galaxy Emperor',
      subtitle: 'The Ruler Beyond the Stars',
      world: 'Galaxy Frontier',
      story:
        'A cosmic sovereign surrounded by ancient energy. His power comes from worlds far beyond the known universe.',
      type: 'Cosmic',
    },
    ocean_guardian: {
      name: 'Ocean Guardian',
      subtitle: 'Keeper of the Deep',
      world: 'Ocean Realm',
      story: 'An ancient guardian protecting the secrets hidden beneath the deepest waters.',
      type: 'Guardian',
    },
    cyber_samurai: {
      name: 'Cyber Samurai',
      subtitle: 'The Neon Blade',
      world: 'Neon Shrine',
      story: 'A warrior forged between tradition and technology. Fast, precise and impossible to predict.',
      type: 'Warrior',
    },
    inferno: {
      name: 'Inferno',
      subtitle: 'Keeper of the Last Spark',
      world: 'Ember Caves',
      story: 'Born in the heart of a volcano. Wherever he walks, the stone stays warm for a long time.',
      type: 'Fire',
    },
    toxic: {
      name: 'Toxic',
      subtitle: 'Reactor Engineer',
      world: 'Neon Plant',
      story: 'Repairs the reactors no one else dares to approach. Never takes the goggles off, even asleep.',
      type: 'Engineer',
    },
    desert_nomad: {
      name: 'Desert Nomad',
      subtitle: 'Guide Through the Storms',
      world: 'Sand Citadel',
      story: 'Knows every path to the citadel on the horizon. His goggles remember a caravan he never left.',
      type: 'Explorer',
    },
    sakura_blossom: {
      name: 'Sakura',
      subtitle: 'Voice of the Blooming Shrine',
      world: 'Blossom Shrine',
      story: 'Keeper of the red torii. The wind brings her petals from every garden that remembers her.',
      type: 'Spirit',
    },
    lunar_witch: {
      name: 'Lunar Witch',
      subtitle: 'Spells of the Full Moon',
      world: 'Moonlit City',
      story: 'She casts violet fire over the rooftops of the old city. Her staff remembers a hundred spells.',
      type: 'Mystic',
    },
    crystal_prince: {
      name: 'Crystal Prince',
      subtitle: 'Heir to the Buried Crown',
      world: 'Amethyst Ruins',
      story: 'The last of the royal line. Crystals grow wherever he stands for longer than a minute.',
      type: 'Crystal',
    },
  },
  progress: {
    label: 'Progress',
    title: 'A reason to come back',
    lead: 'Something is always waiting: a streak reward, fresh tasks, income from your assets and the next league.',
    daily: 'Daily reward · day {day} of {total}',
    day: 'Day {day}',
    dayAria: 'Day {day}: {amount} PAW',
    claim: '{label} — claim',
    everyDay: 'Every day',
    tasks: [
      { title: 'Daily combo', text: 'Find the three assets of the day', reward: 'from 50,000' },
      { title: 'Daily cipher', text: 'Tap out the word of the day in Morse code', reward: 'from 10,000' },
      { title: 'Invite friends', text: 'A bonus for both of you · 25,000 with Premium', reward: '5,000' },
    ],
    leagues: 'Leagues',
    leaguesText: 'Ranked by everything you have earned',
  },
  airdrop: {
    label: 'Airdrop',
    title: 'Your journey matters',
    lead: 'Airdrop points are all the PAW you have earned. Progress is tracked in the game against six clear requirements.',
    pillars: [
      { title: 'Participation', text: 'Play regularly and keep your streak.' },
      { title: 'Progression', text: 'Levels, leagues and upgraded assets.' },
      { title: 'Requirements', text: 'Six goals, each with its own progress bar.' },
      { title: 'Community', text: 'Friends you bring along count too.' },
    ],
    progress: 'Example progress',
    example: 'Demo player',
    reqs: {
      league: 'Reach Platinum league',
      level: 'Reach level 10',
      friends: 'Invite 3 friends',
      streak: '7-day streak',
      cards: 'Unlock 6 assets',
      tasks: 'Complete 5 tasks',
    },
    fine: 'Distribution details will be announced later. Nothing here is a promise of income or rewards; no wallet is needed to play.',
  },
  partners: {
    label: 'Partnership',
    title: 'Build with us',
    lead: 'Meowgul is a Telegram-native game with characters, daily habits and a growing community — a natural place for brands and projects to meet players.',
    offers: [
      {
        title: 'Telegram-native audience',
        text: 'Players open the game inside Telegram — no installs, no friction.',
      },
      {
        title: 'A game ecosystem',
        text: 'Characters, collection, leagues and daily tasks — many natural touchpoints.',
      },
      {
        title: 'Community-driven growth',
        text: 'Players bring friends: referrals and shared goals are built into the game.',
      },
      {
        title: 'Events and challenges',
        text: 'Special in-game events and branded challenges built with you.',
      },
      {
        title: 'Rewards and collaborations',
        text: 'Joint rewards, tasks or characters that players actually want.',
      },
      { title: 'Visibility', text: 'A presence in a place players return to every day.' },
    ],
    metrics: {
      users: 'Active users',
      community: 'Community',
      retention: 'Retention',
      countries: 'Countries',
    },
    onRequest: 'On request',
    contact: 'Requests go straight to the team.',
  },
  roadmap: {
    label: 'Roadmap',
    title: 'Where we are going',
    lead: 'What is live is marked live. Everything else is a plan and may change as the world grows.',
    states: { done: 'Live', now: 'In progress', next: 'Next', later: 'Later' },
    stages: [
      { title: 'Foundation', items: ['Telegram Mini App', 'Core game', 'Game economy'] },
      {
        title: 'Gameplay',
        items: ['Energy and boosts', '59 upgradable assets', 'Daily tasks and cipher', 'Levels and leagues'],
      },
      { title: 'Collection', items: ['Characters and skins', 'Tap effects', 'New characters'] },
      { title: 'Community', items: ['Community events', 'Competitive mechanics', 'Partner collaborations'] },
      { title: 'Expansion', items: ['New game systems', 'New stories', 'A growing universe'] },
    ],
  },
  community: {
    label: 'Community',
    title: 'The world is better together',
    lead: 'Telegram is our home: news, updates and new characters land there first.',
    faq: 'FAQ',
    items: [
      {
        q: 'What is Meowgul?',
        a: 'A game inside Telegram about cats, collecting and long progression, built to grow with its community.',
      },
      {
        q: 'How do I start playing?',
        a: 'Tap “Play” — the Mini App opens right in Telegram. No download, no registration.',
      },
      {
        q: 'Where is the game?',
        a: 'Inside Telegram, as a Mini App of our bot. It works on phone and desktop.',
      },
      {
        q: 'How do I earn rewards?',
        a: 'Tap, upgrade assets for hourly income, keep your daily streak, solve the combo and cipher, complete tasks and invite friends.',
      },
      {
        q: 'What is the airdrop?',
        a: 'Airdrop points are the PAW you earn; the game shows six requirements and your progress. Distribution details will be announced — nothing is guaranteed.',
      },
      {
        q: 'How do I unlock new characters?',
        a: 'Characters and skins live in the Collection inside the game; new ones arrive with updates. Tap effects unlock with your level.',
      },
      {
        q: 'How can I become a partner?',
        a: 'Press “Become a partner” — your request goes straight to the team.',
      },
    ],
  },
  footer: {
    about: 'A game inside Telegram about cats, collecting and a growing universe.',
    slogan: 'The story has just begun.',
    navigate: 'Navigate',
    connect: 'Community',
    partnership: 'Partnership',
    fine: 'PAW and in-game assets are game items: they cannot be withdrawn, sold or transferred.',
    nav: 'Footer',
  },
};

export type Dict = typeof en;
