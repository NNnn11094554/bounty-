import type { Dict } from './en';

export const de: Dict = {
  meta: {
    title: 'Meowgul — ein Katzenuniversum in Telegram',
    description:
      'Meowgul ist ein Spiel in Telegram: tippen, Charaktere sammeln, das Konto ausbauen und zehn Ligen aufsteigen. Es wächst mit seiner Community.',
  },
  nav: {
    project: 'Projekt',
    gameplay: 'Gameplay',
    collection: 'Sammlung',
    airdrop: 'Airdrop',
    roadmap: 'Roadmap',
    community: 'Community',
    sections: 'Bereiche',
    menu: 'Menü',
    homeAria: 'Meowgul — zur Startseite',
    language: 'Sprache',
  },
  cta: {
    play: 'Spielen',
    learn: 'Über das Projekt',
    checkProgress: 'Fortschritt prüfen',
    partner: 'Partner werden',
  },
  social: { telegram: 'Telegram', x: 'X', community: 'Community', soon: 'Bald', main: 'Hauptkanal' },
  hero: {
    label: 'Telegram Mini App',
    title: 'Betritt die Welt von Meowgul',
    lead: 'Ein lebendiges Spiel in Telegram, in dem dich jeder Tipp, jedes Upgrade und jede Entdeckung tiefer in ein wachsendes Universum führt.',
    scroll: 'Scrollen',
  },
  project: {
    label: 'Das Projekt',
    title: 'Eine Welt, Katze für Katze gebaut',
    blocks: [
      {
        title: 'Was es ist',
        text: 'Ein Spiel in Telegram. Mit einem Tipp geöffnet, ohne Installation: tippen, ausbauen und Katzen mit eigener Geschichte sammeln.',
      },
      {
        title: 'Warum es das gibt',
        text: 'Die meisten Tap-Spiele sind ein Bildschirm und eine Zahl. Meowgul bringt mit, wofür man zurückkommt: Charaktere, eine Sammlung und Fortschritt, der bleibt.',
      },
      {
        title: 'Was du bekommst',
        text: 'Kurze Sessions mit echtem Fortschritt: Einkommen, das wächst, während du weg bist, tägliche Belohnungen, Ligen und Charaktere zum Sammeln.',
      },
      {
        title: 'Wohin es geht',
        text: 'Mehr Charaktere, Community-Events und neue Spielsysteme — Schritt für Schritt, während die Welt wächst.',
      },
    ],
    facts: [
      { value: '1 Tipp', label: 'zum Start' },
      { value: '10', label: 'Charaktere' },
      { value: '50', label: 'Level' },
      { value: '60', label: 'Erfolge' },
    ],
  },
  gameplay: {
    label: 'Gameplay',
    title: 'So funktioniert es',
    lead: 'Ein Kreislauf aus fünf Schritten — und jeden Tag bringt er dich ein Stück weiter.',
    loop: [
      {
        title: 'Spielen',
        text: 'Tippe auf die Katze und verdiene PAW.',
        detail: 'Jeder Tipp kostet 1 Energie · 5.000 Energie, +3 pro Sekunde',
      },
      {
        title: 'Sammeln',
        text: 'Charaktere, Skins und Tipp-Effekte.',
        detail: 'Seltenheit ändert den Look, nie die Wirtschaft',
      },
      {
        title: 'Ausbauen',
        text: 'Assets verbessern, Level und Liga steigern.',
        detail: '59 Assets bringen stündlich Ertrag — auch offline, bis zu 3 Std.',
      },
      {
        title: 'Entdecken',
        text: 'Tageskombo, Morse-Code und Aufgaben.',
        detail: '60 Erfolge warten unterwegs',
      },
      {
        title: 'Zurückkommen',
        text: 'Eine Belohnungsserie und dein Einkommen warten auf dich.',
        detail: '10-Tage-Serie · jeden Tag neue Aufgaben',
      },
    ],
    boosts: [
      { title: 'Turbo', text: '×5 pro Tipp für 60 s, ohne Energieverbrauch · 3 pro Tag' },
      { title: 'Volle Energie', text: 'Sofort komplett aufgeladen · 6 pro Tag' },
    ],
    energy: 'Energie',
    turboOn: 'Turbo · ohne Energie',
    turbo: 'Turbo ×{x}',
    turboAria: 'Turbo: heute noch {left} von {total}',
    demo: 'Probier es aus: tippe auf die Katze',
    tapHint: 'Tippe auf die Katze',
    noEnergy: 'Keine Energie',
  },
  collection: {
    label: 'Die Sammlung',
    title: 'Jede Katze hat ihre Geschichte',
    lead: 'Von lautlosen Assassinen bis zu kosmischen Kaisern — jeder Charakter hat eine Welt, eine Seltenheit und eine Geschichte. Wischen, tippen oder die Pfeile nutzen.',
    rarity: 'Seltenheit',
    type: 'Typ',
    power: 'Stärke',
    prev: 'Vorherige Katze',
    next: 'Nächste Katze',
    list: 'Katzen',
    tiers: 'Seltenheitsstufen',
    tierText: {
      COMMON: 'Hier beginnt jede Sammlung.',
      RARE: 'Markanter Look, schwerer zu finden.',
      EPIC: 'Charaktere mit eigener Welt.',
      LEGENDARY: 'Ikonen des Universums.',
      MYTHIC: 'Fast unerreichbar.',
    },
    note: 'Seltenheit betrifft das Aussehen, nicht die Stärke in der Wirtschaft. Tipp-Effekte werden mit steigendem Level freigeschaltet.',
    explore: 'Zur Sammlung →',
  },
  rarity: { COMMON: 'Gewöhnlich', RARE: 'Selten', EPIC: 'Episch', LEGENDARY: 'Legendär', MYTHIC: 'Mythisch' },
  cats: {
    stealth_assassin: {
      name: 'Schatten-Assassine',
      subtitle: 'Der lautlose Jäger',
      world: 'Schattenviertel',
      story:
        'Ein Meister der Präzision und Geduld. Diese legendäre Katze bewegt sich durch die Schatten und wartet auf den perfekten Moment zum Zuschlagen.',
      type: 'Assassine',
    },
    galaxy_emperor: {
      name: 'Galaxie-Imperator',
      subtitle: 'Der Herrscher jenseits der Sterne',
      world: 'Galaktische Grenze',
      story:
        'Ein kosmischer Herrscher, umgeben von uralter Energie. Seine Macht stammt aus Welten weit jenseits des bekannten Universums.',
      type: 'Kosmisch',
    },
    ocean_guardian: {
      name: 'Ozeanwächter',
      subtitle: 'Hüter der Tiefe',
      world: 'Ozeanreich',
      story: 'Ein uralter Wächter, der die Geheimnisse in den tiefsten Gewässern beschützt.',
      type: 'Wächter',
    },
    cyber_samurai: {
      name: 'Cyber-Samurai',
      subtitle: 'Die Neonklinge',
      world: 'Neonschrein',
      story:
        'Ein Krieger, geschmiedet zwischen Tradition und Technologie. Schnell, präzise und unberechenbar.',
      type: 'Krieger',
    },
    inferno: {
      name: 'Inferno',
      subtitle: 'Hüter des letzten Funkens',
      world: 'Glutgrotten',
      story: 'Geboren im Herzen eines Vulkans. Wo er entlanggeht, bleibt der Stein noch lange warm.',
      type: 'Feuer',
    },
    toxic: {
      name: 'Toxic',
      subtitle: 'Reaktor-Ingenieur',
      world: 'Neonwerk',
      story:
        'Repariert Reaktoren, an die sich sonst niemand herantraut. Nimmt die Schutzbrille nicht einmal im Schlaf ab.',
      type: 'Ingenieur',
    },
    desert_nomad: {
      name: 'Wüstennomade',
      subtitle: 'Führer durch die Stürme',
      world: 'Sandzitadelle',
      story:
        'Kennt jeden Pfad zur Zitadelle am Horizont. Seine Brille erinnert sich an eine Karawane, die er nie im Stich ließ.',
      type: 'Entdecker',
    },
    sakura_blossom: {
      name: 'Sakura',
      subtitle: 'Die Stimme des blühenden Schreins',
      world: 'Kirschblütenschrein',
      story:
        'Hüterin der roten Torii. Der Wind bringt ihr Blüten aus jedem Garten, der sich noch an sie erinnert.',
      type: 'Geist',
    },
    lunar_witch: {
      name: 'Mondhexe',
      subtitle: 'Zauber des Vollmonds',
      world: 'Mondscheinstadt',
      story:
        'Sie wirft violettes Feuer über die Dächer der alten Stadt. Ihr Stab kennt hundert Zaubersprüche.',
      type: 'Mystiker',
    },
    crystal_prince: {
      name: 'Kristallprinz',
      subtitle: 'Erbe der vergrabenen Krone',
      world: 'Amethystruinen',
      story: 'Der Letzte seines Königshauses. Wo er länger als eine Minute steht, wachsen Kristalle.',
      type: 'Kristall',
    },
  },
  progress: {
    label: 'Fortschritt',
    title: 'Ein Grund zurückzukommen',
    lead: 'Es wartet immer etwas: die Belohnung deiner Serie, neue Aufgaben, Ertrag deiner Assets und die nächste Liga.',
    daily: 'Tagesbelohnung · Tag {day} von {total}',
    day: 'Tag {day}',
    dayAria: 'Tag {day}: {amount} PAW',
    claim: '{label} — abholen',
    everyDay: 'Jeden Tag',
    tasks: [
      { title: 'Tageskombo', text: 'Finde die drei Assets des Tages', reward: 'ab 50.000' },
      { title: 'Tageschiffre', text: 'Tippe das Wort des Tages im Morsecode', reward: 'ab 10.000' },
      { title: 'Freunde einladen', text: 'Ein Bonus für euch beide · 25.000 mit Premium', reward: '5.000' },
    ],
    leagues: 'Ligen',
    leaguesText: 'Nach allem, was du verdient hast',
  },
  airdrop: {
    label: 'Airdrop',
    title: 'Dein Weg zählt',
    lead: 'Airdrop-Punkte sind alle PAW, die du verdient hast. Der Fortschritt wird im Spiel anhand von sechs klaren Anforderungen erfasst.',
    pillars: [
      { title: 'Teilnahme', text: 'Regelmäßig spielen und die Serie halten.' },
      { title: 'Fortschritt', text: 'Level, Ligen und verbesserte Assets.' },
      { title: 'Anforderungen', text: 'Sechs Ziele, jedes mit eigenem Balken.' },
      { title: 'Community', text: 'Freunde, die du mitbringst, zählen auch.' },
    ],
    progress: 'Beispiel-Fortschritt',
    example: 'Demo-Spieler',
    reqs: {
      league: 'Liga Platinum erreichen',
      level: 'Level 10 erreichen',
      friends: '3 Freunde einladen',
      streak: '7-Tage-Serie',
      cards: '6 Assets freischalten',
      tasks: '5 Aufgaben erledigen',
    },
    fine: 'Details zur Verteilung werden später bekannt gegeben. Nichts hier ist ein Versprechen von Einkommen oder Belohnungen; zum Spielen brauchst du keine Wallet.',
  },
  partners: {
    label: 'Partnerschaft',
    title: 'Gemeinsam bauen',
    lead: 'Meowgul ist ein Telegram-natives Spiel mit Charakteren, täglichen Gewohnheiten und einer wachsenden Community — ein natürlicher Ort, an dem Marken und Projekte Spieler treffen.',
    offers: [
      {
        title: 'Telegram-native Zielgruppe',
        text: 'Spieler öffnen das Spiel direkt in Telegram — ohne Installation, ohne Hürden.',
      },
      {
        title: 'Ein Spiel-Ökosystem',
        text: 'Charaktere, Sammlung, Ligen und tägliche Aufgaben — viele natürliche Kontaktpunkte.',
      },
      {
        title: 'Wachstum durch die Community',
        text: 'Spieler bringen Freunde mit: Empfehlungen und gemeinsame Ziele sind ins Spiel eingebaut.',
      },
      {
        title: 'Events und Challenges',
        text: 'Besondere Events im Spiel und Marken-Challenges, gemeinsam mit dir entwickelt.',
      },
      {
        title: 'Belohnungen und Kooperationen',
        text: 'Gemeinsame Belohnungen, Aufgaben oder Charaktere, die Spieler wirklich wollen.',
      },
      { title: 'Sichtbarkeit', text: 'Präsenz an einem Ort, an den Spieler jeden Tag zurückkehren.' },
    ],
    metrics: { users: 'Aktive Nutzer', community: 'Community', retention: 'Retention', countries: 'Länder' },
    onRequest: 'Auf Anfrage',
    contact: 'Anfragen gehen direkt an das Team.',
  },
  roadmap: {
    label: 'Roadmap',
    title: 'Wohin wir gehen',
    lead: 'Was schon läuft, ist markiert. Alles andere ist ein Plan und kann sich ändern, während die Welt wächst.',
    states: { done: 'Live', now: 'In Arbeit', next: 'Als Nächstes', later: 'Später' },
    stages: [
      { title: 'Fundament', items: ['Telegram Mini App', 'Kernspiel', 'Spielwirtschaft'] },
      {
        title: 'Gameplay',
        items: [
          'Energie und Boosts',
          '59 ausbaubare Assets',
          'Tägliche Aufgaben und Code',
          'Level und Ligen',
        ],
      },
      { title: 'Sammlung', items: ['Charaktere und Skins', 'Tipp-Effekte', 'Neue Charaktere'] },
      { title: 'Community', items: ['Community-Events', 'Wettbewerbsmechaniken', 'Partner-Kooperationen'] },
      { title: 'Erweiterung', items: ['Neue Spielsysteme', 'Neue Geschichten', 'Ein wachsendes Universum'] },
    ],
  },
  community: {
    label: 'Community',
    title: 'Gemeinsam ist die Welt schöner',
    lead: 'Telegram ist unser Zuhause: Neuigkeiten, Updates und neue Charaktere erscheinen dort zuerst.',
    faq: 'Häufige Fragen',
    items: [
      {
        q: 'Was ist Meowgul?',
        a: 'Ein Spiel in Telegram über Katzen, Sammeln und langfristigen Fortschritt, das mit seiner Community wächst.',
      },
      {
        q: 'Wie fange ich an?',
        a: 'Tippe auf „Spielen“ — die Mini App öffnet sich direkt in Telegram. Kein Download, keine Registrierung.',
      },
      {
        q: 'Wo ist das Spiel?',
        a: 'In Telegram, als Mini App unseres Bots. Es läuft auf dem Smartphone und am Computer.',
      },
      {
        q: 'Wie bekomme ich Belohnungen?',
        a: 'Tippen, Assets für stündlichen Ertrag ausbauen, die tägliche Serie halten, Kombo und Code lösen, Aufgaben erledigen und Freunde einladen.',
      },
      {
        q: 'Was ist der Airdrop?',
        a: 'Airdrop-Punkte sind die PAW, die du verdienst; das Spiel zeigt sechs Anforderungen und deinen Fortschritt. Details zur Verteilung folgen — nichts ist garantiert.',
      },
      {
        q: 'Wie schalte ich neue Charaktere frei?',
        a: 'Charaktere und Skins findest du in der Sammlung im Spiel; neue kommen mit Updates. Tipp-Effekte werden mit deinem Level freigeschaltet.',
      },
      {
        q: 'Wie werde ich Partner?',
        a: 'Tippe auf „Partner werden“ — deine Anfrage geht direkt an das Team.',
      },
    ],
  },
  footer: {
    about: 'Ein Telegram-Spiel über Katzen, Sammeln und ein wachsendes Universum.',
    slogan: 'Die Geschichte hat gerade erst begonnen.',
    navigate: 'Navigation',
    connect: 'Community',
    partnership: 'Partnerschaft',
    fine: 'PAW und Assets im Spiel sind Spielgegenstände: Sie können nicht ausgezahlt, verkauft oder übertragen werden.',
    nav: 'Fußzeile',
  },
};
