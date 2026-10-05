import type { Dict } from './en';

export const fr: Dict = {
  meta: {
    title: 'Meowgul — Entrez dans le monde',
    description:
      'Meowgul est un jeu vivant sur Telegram : tapez, améliorez, collectionnez des chats uniques et plongez dans un univers en pleine expansion.',
  },
  nav: {
    home: 'Accueil',
    world: 'Univers',
    play: 'Comment jouer',
    collection: 'Collection',
    airdrop: 'Airdrop',
    roadmap: 'Feuille de route',
    sections: 'Sections',
    menu: 'Menu',
    homeAria: 'Meowgul — accueil',
    language: 'Langue',
  },
  cta: { play: 'Jouer', explore: 'Explorer l’univers' },
  social: { telegram: 'Rejoindre Telegram', x: 'Suivre sur X', community: 'Communauté', soon: 'Bientôt' },
  hero: {
    label: 'Mini App Telegram',
    title: 'Entrez dans le monde de Meowgul',
    lead: 'Un jeu vivant sur Telegram, où chaque tap, chaque amélioration et chaque découverte vous entraînent plus loin dans un univers en pleine expansion.',
    scroll: 'Défiler',
  },
  world: {
    label: 'Notre histoire',
    title: 'Un monde bâti chat après chat',
    lead: 'Ce qui a commencé par un simple tap est devenu bien plus grand : un univers de chats uniques, de mondes mystérieux, de personnages rares et de progression sans fin, construit directement dans Telegram. Chaque personnage a sa propre identité. Chaque monde, sa propre histoire.',
    motto: 'Collectionnez. Améliorez. Explorez.',
    facts: [
      {
        value: '1 tap',
        label: 'pour commencer',
        text: 'Une Mini App qui s’ouvre directement dans Telegram, sans téléchargement.',
      },
      { value: '10', label: 'personnages', text: 'Chacun avec son monde, sa rareté et son histoire.' },
      { value: '50', label: 'niveaux', text: 'Et dix ligues, de Bronze à Lord.' },
      {
        value: '59',
        label: 'actifs',
        text: 'Des améliorations qui continuent à rapporter même en votre absence.',
      },
    ],
    journey: 'Le chemin parcouru',
    steps: [
      { title: 'Le premier chat', text: 'L’aventure commence.' },
      { title: 'La collection', text: 'Découvrez des personnages uniques et des skins rares.' },
      { title: 'L’évolution', text: 'Améliorez, progressez, débloquez de nouvelles possibilités.' },
      { title: 'Le monde s’agrandit', text: 'De nouveaux personnages, mécaniques et expériences arrivent.' },
    ],
  },
  play: {
    label: 'Gameplay',
    title: 'Comment ça marche',
    lead: 'Des sessions courtes, une progression durable. Tapez pour gagner, investissez vos PAW dans des actifs qui continuent à rapporter, collectionnez des personnages et grimpez dans les ligues.',
    steps: [
      {
        title: 'Tapez',
        text: 'Gagnez des récompenses en jouant activement.',
        detail: 'Chaque tap consomme 1 point d’énergie. 5 000 au total, avec +3 récupérés par seconde.',
      },
      {
        title: 'Améliorez',
        text: 'Faites progresser votre aventure et débloquez de nouvelles possibilités.',
        detail:
          '59 actifs répartis en quatre groupes rapportent des PAW chaque heure — même hors ligne, jusqu’à 3 heures.',
      },
      {
        title: 'Collectionnez',
        text: 'Découvrez des chats uniques, des skins et des personnages rares.',
        detail:
          'Les skins changent l’apparence de votre chat, jamais l’économie : du style, pas du pay-to-win.',
      },
      {
        title: 'Affrontez',
        text: 'Grimpez dans les ligues et prouvez votre place dans ce monde.',
        detail: 'Dix ligues classées selon tout ce que vous avez gagné, de Bronze à Lord.',
      },
    ],
    boosts: [
      { title: 'Turbo', text: '×5 par tap pendant 60 s, sans dépenser d’énergie · 3 par jour' },
      { title: 'Énergie pleine', text: 'Recharge complète instantanée · 6 par jour' },
    ],
    energy: 'Énergie',
    turboOn: 'Turbo · sans énergie',
    turbo: 'Turbo ×{x}',
    turboAria: 'Turbo : encore {left} sur {total} aujourd’hui',
    demo: 'Démo du jeu',
    tapHint: 'Tapez sur le chat',
    noEnergy: 'Plus d’énergie',
  },
  collection: {
    label: 'Les chats',
    title: 'Chaque chat a son histoire',
    lead: 'Des assassins silencieux aux empereurs cosmiques, chaque personnage incarne une facette différente du monde. Chaque chat fait partie d’une collection qui ne cesse de grandir : découvrez de nouveaux personnages, débloquez des skins rares et composez une équipe à l’image de votre aventure.',
    rarity: 'Rareté',
    type: 'Type',
    power: 'Puissance',
    prev: 'Chat précédent',
    next: 'Chat suivant',
    list: 'Chats',
    tiers: 'Niveaux de rareté',
    tierText: {
      COMMON: 'Là où commence toute collection.',
      RARE: 'Un look distinctif, plus difficile à trouver.',
      EPIC: 'Des personnages avec leur propre monde.',
      LEGENDARY: 'Les icônes de l’univers.',
      MYTHIC: 'Presque hors d’atteinte.',
    },
    note: 'La rareté est une question d’apparence, pas de puissance économique. Les effets de tap se débloquent en montant de niveau.',
    explore: 'Voir la collection →',
  },
  rarity: { COMMON: 'Commun', RARE: 'Rare', EPIC: 'Épique', LEGENDARY: 'Légendaire', MYTHIC: 'Mythique' },
  cats: {
    stealth_assassin: {
      name: 'Assassin Furtif',
      subtitle: 'Le chasseur silencieux',
      world: 'Quartier des Ombres',
      story:
        'Un maître de la précision et de la patience. Ce chat légendaire se déplace dans l’ombre et attend le moment parfait pour frapper.',
      type: 'Assassin',
    },
    galaxy_emperor: {
      name: 'Empereur Galactique',
      subtitle: 'Le souverain d’au-delà des étoiles',
      world: 'Frontière Galactique',
      story:
        'Un souverain cosmique entouré d’une énergie ancestrale. Son pouvoir vient de mondes bien au-delà de l’univers connu.',
      type: 'Cosmique',
    },
    ocean_guardian: {
      name: 'Gardien de l’Océan',
      subtitle: 'Le gardien des abysses',
      world: 'Royaume de l’Océan',
      story: 'Un gardien ancestral qui protège les secrets enfouis sous les eaux les plus profondes.',
      type: 'Gardien',
    },
    cyber_samurai: {
      name: 'Cyber Samouraï',
      subtitle: 'La lame de néon',
      world: 'Sanctuaire de Néon',
      story: 'Un guerrier forgé entre tradition et technologie. Rapide, précis et impossible à prévoir.',
      type: 'Guerrier',
    },
    inferno: {
      name: 'Inferno',
      subtitle: 'Gardien de la dernière étincelle',
      world: 'Grottes de Braise',
      story: 'Né au cœur d’un volcan. Là où il passe, la pierre reste chaude longtemps.',
      type: 'Feu',
    },
    toxic: {
      name: 'Toxique',
      subtitle: 'Ingénieur des réacteurs',
      world: 'Usine de Néon',
      story:
        'Il répare les réacteurs dont personne n’ose s’approcher. Il ne quitte jamais ses lunettes, même pour dormir.',
      type: 'Ingénieur',
    },
    desert_nomad: {
      name: 'Nomade du Désert',
      subtitle: 'Le guide des tempêtes',
      world: 'Citadelle des Sables',
      story:
        'Il connaît chaque sentier menant à la citadelle à l’horizon. Ses lunettes se souviennent d’une caravane qu’il n’a jamais abandonnée.',
      type: 'Explorateur',
    },
    sakura_blossom: {
      name: 'Sakura',
      subtitle: 'La voix du sanctuaire en fleurs',
      world: 'Sanctuaire des Cerisiers',
      story:
        'Gardienne des torii rouges. Le vent lui apporte les pétales de tous les jardins qui se souviennent d’elle.',
      type: 'Esprit',
    },
    lunar_witch: {
      name: 'Sorcière Lunaire',
      subtitle: 'Les sortilèges de la pleine lune',
      world: 'Cité au Clair de Lune',
      story:
        'Elle lance un feu violet sur les toits de la vieille ville. Son bâton se souvient d’une centaine de sorts.',
      type: 'Mystique',
    },
    crystal_prince: {
      name: 'Prince de Cristal',
      subtitle: 'L’héritier de la couronne enfouie',
      world: 'Ruines d’Améthyste',
      story: 'Le dernier de la lignée royale. Des cristaux poussent partout où il reste plus d’une minute.',
      type: 'Cristal',
    },
  },
  rewards: {
    label: 'Progression et récompenses',
    title: 'Votre parcours compte',
    lead: 'Votre activité, votre progression et votre participation font partie de votre parcours dans l’écosystème. Continuez à jouer. Accomplissez des activités. Développez votre collection. Restez actif.',
    daily: 'Récompense quotidienne · jour {day} sur {total}',
    day: 'Jour {day}',
    dayAria: 'Jour {day} : {amount} PAW',
    claim: '{label} — récupérer',
    everyDay: 'Chaque jour',
    tasks: [
      { title: 'Combo du jour', text: 'Trouvez les trois actifs du jour', reward: 'dès 50 000' },
      { title: 'Code du jour', text: 'Tapez le mot du jour en morse', reward: 'dès 10 000' },
      { title: 'Invitez vos amis', text: 'Un bonus pour vous deux · 25 000 avec Premium', reward: '5 000' },
    ],
    pillars: [
      { title: 'Activité', text: 'Jouez régulièrement et gardez votre série.' },
      { title: 'Progression', text: 'Niveaux, ligues et améliorations.' },
      { title: 'Succès', text: 'Les tâches et étapes que vous accomplissez.' },
      { title: 'Communauté', text: 'Les amis que vous embarquez.' },
    ],
    progress: 'Airdrop · progression du parcours',
    example: 'Joueur type',
    reqs: {
      league: 'Atteindre la ligue Platinum',
      level: 'Atteindre le niveau 10',
      friends: 'Inviter 3 amis',
      streak: 'Série de 7 jours',
      cards: 'Débloquer 6 actifs',
      tasks: 'Accomplir 5 tâches',
    },
    fine: 'Détails de l’airdrop : bientôt, annoncés au fil de l’évolution du système. Rien sur cette page ne constitue une promesse de récompense.',
  },
  roadmap: {
    label: 'Feuille de route',
    title: 'Un monde sans niveau final',
    lead: 'Au-delà du jeu principal s’étend un univers grandissant de personnages, de lieux, d’événements et de découvertes. Les nouveaux mondes apporteront de nouveaux personnages, de nouvelles mécaniques et de nouvelles façons de jouer. Le jeu principal est disponible ; les prochaines phases sont en développement.',
    phase: 'Phase {n}',
    states: { done: 'Disponible', next: 'Ensuite', later: 'Plus tard', unknown: 'Inconnu' },
    phases: [
      {
        title: 'Genèse',
        items: ['Jeu principal', 'Mini App Telegram', 'Premiers personnages', 'Collection'],
      },
      {
        title: 'Expansion',
        items: [
          'Nouveaux personnages',
          'Nouveaux skins',
          'Plus d’améliorations',
          'Événements',
          'Nouveaux mondes',
        ],
      },
      {
        title: 'Écosystème',
        items: ['Fonctions communautaires', 'Mécaniques compétitives', 'Nouveaux systèmes de jeu'],
      },
      { title: 'Le prochain monde', items: ['???'] },
    ],
    worlds: 'Mondes en développement',
    soon: 'Bientôt',
    undiscovered: 'Inexploré',
    worldList: [
      {
        name: 'Quartier des Ombres',
        text: 'Une ville régie par des chasseurs silencieux et des secrets bien gardés.',
      },
      { name: 'Frontière Galactique', text: 'Un monde lointain où l’énergie cosmique façonne tout.' },
      { name: 'Royaume de l’Océan', text: 'Un royaume ancestral caché sous des eaux sans fin.' },
      { name: 'L’inconnu', text: 'Quelque chose attend au-delà du monde connu.' },
    ],
  },
  community: {
    label: 'Communauté',
    title: 'Le monde est plus beau ensemble',
    lead: 'Suivez l’aventure, découvrez de nouveaux personnages et rejoignez la communauté tandis que l’univers continue de grandir.',
    faq: 'Questions fréquentes',
    items: [
      {
        q: 'Qu’est-ce que ce jeu ?',
        a: 'Un jeu sur Telegram centré sur la collection, la progression et un univers de personnages en constante évolution.',
      },
      {
        q: 'Comment commencer à jouer ?',
        a: 'Ouvrez la Mini App dans Telegram et commencez votre aventure.',
      },
      {
        q: 'Que peut-on collectionner ?',
        a: 'Des personnages, des skins, des récompenses et d’autres objets du jeu.',
      },
      {
        q: 'De nouveaux personnages arriveront-ils ?',
        a: 'Oui. La collection et l’univers sont conçus pour s’étendre au fil du temps.',
      },
      {
        q: 'Comment fonctionne l’airdrop ?',
        a: 'La participation et la progression font partie de l’expérience actuelle de l’écosystème. D’autres détails pourront être annoncés au fil de l’évolution du système.',
      },
    ],
  },
  final: { title: 'Le monde ne fait que commencer', lead: 'Votre aventure commence par un simple tap.' },
  footer: {
    about: 'Un jeu Telegram sur les chats, la collection et un univers en pleine expansion.',
    fine: 'Les PAW et les actifs du jeu sont des objets de jeu : ils ne peuvent être ni retirés, ni vendus, ni transférés.',
    nav: 'Pied de page',
  },
};
