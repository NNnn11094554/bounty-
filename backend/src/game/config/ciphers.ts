/**
 * Слова шифра дня (латиница, 4–7 букв) с подсказками-загадками. Если админ не задал шифр на день,
 * сервер берёт случайное слово отсюда. Слово вводится азбукой Морзе тапами по коту.
 */
export interface CipherWord {
  word: string;
  hintRu: string;
  hintEn: string;
}

export const CIPHER_WORDS: readonly CipherWord[] = [
  {
    word: 'MEOW',
    hintRu: 'Главное слово любого кота (по-английски)',
    hintEn: 'The most important word of any cat',
  },
  { word: 'PURR', hintRu: 'Звук довольного кота (по-английски)', hintEn: 'The sound of a happy cat' },
  { word: 'PAWS', hintRu: 'У кота их четыре (по-английски, мн. ч.)', hintEn: 'A cat has four of them' },
  {
    word: 'TUNA',
    hintRu: 'Рыба, ради которой кот продаст биржу',
    hintEn: 'The fish a cat would sell the exchange for',
  },
  { word: 'MOUSE', hintRu: 'Любимая добыча и игрушка (по-английски)', hintEn: 'Favourite prey and toy' },
  { word: 'KITTEN', hintRu: 'Маленький кот (по-английски)', hintEn: 'A little cat' },
  { word: 'WHISKER', hintRu: 'Усы кота, один ус (по-английски)', hintEn: 'One of the cat’s face antennas' },
  { word: 'CLAWS', hintRu: 'Ими точат когтеточку (по-английски)', hintEn: 'What a scratching post is for' },
  { word: 'NAPS', hintRu: 'Короткие сны днём (по-английски, мн. ч.)', hintEn: 'Short daytime sleeps' },
  { word: 'TAIL', hintRu: 'Пушистое продолжение кота (по-английски)', hintEn: 'The fluffy end of a cat' },
  { word: 'MILK', hintRu: 'Белый напиток из миски (по-английски)', hintEn: 'A white drink from the bowl' },
  { word: 'YARN', hintRu: 'Клубок ниток (по-английски)', hintEn: 'A ball of it is the best toy' },
  { word: 'BOXES', hintRu: 'Лучшие офисы кота (по-английски, мн. ч.)', hintEn: 'The best offices for a cat' },
  { word: 'LASER', hintRu: 'Красная точка, которую не поймать', hintEn: 'The red dot nobody can catch' },
  { word: 'COIN', hintRu: 'Монета (по-английски)', hintEn: 'What you tap for' },
  { word: 'TOKEN', hintRu: 'Цифровой актив (по-английски)', hintEn: 'A digital asset' },
  { word: 'WALLET', hintRu: 'Где хранят монеты (по-английски)', hintEn: 'Where coins are kept' },
  { word: 'MARKET', hintRu: 'Место, где торгуют (по-английски)', hintEn: 'Where trading happens' },
  { word: 'PROFIT', hintRu: 'Прибыль (по-английски)', hintEn: 'What cards bring every hour' },
  { word: 'BULL', hintRu: 'Животное растущего рынка', hintEn: 'The animal of a rising market' },
  { word: 'BEAR', hintRu: 'Животное падающего рынка', hintEn: 'The animal of a falling market' },
  { word: 'MOON', hintRu: 'Куда летит курс (по-английски)', hintEn: 'Where the price is going' },
  { word: 'ROCKET', hintRu: 'На чём летят к Луне (по-английски)', hintEn: 'What takes you to the moon' },
  {
    word: 'STAKE',
    hintRu: 'Заблокировать монеты ради дохода (по-английски)',
    hintEn: 'Lock coins to earn more',
  },
  { word: 'CHAIN', hintRu: 'Цепь блоков (по-английски)', hintEn: 'Blocks linked together' },
  { word: 'BLOCK', hintRu: 'Кирпичик блокчейна (по-английски)', hintEn: 'A brick of the blockchain' },
  { word: 'TRADE', hintRu: 'Сделка (по-английски)', hintEn: 'Buy or sell' },
  { word: 'HODL', hintRu: 'Держать и не продавать (жаргон)', hintEn: 'Hold on for dear life' },
  { word: 'PUMP', hintRu: 'Резкий рост курса (жаргон)', hintEn: 'A sharp rise in price' },
  { word: 'LISTING', hintRu: 'Появление токена на бирже', hintEn: 'When a token appears on an exchange' },
  { word: 'AIRDROP', hintRu: 'Раздача токенов игрокам', hintEn: 'Free tokens for players' },
  { word: 'BONUS', hintRu: 'Бонус (по-английски)', hintEn: 'An extra reward' },
  { word: 'LEVEL', hintRu: 'Уровень (по-английски)', hintEn: 'What cards go up in' },
  { word: 'LEAGUE', hintRu: 'Лига (по-английски)', hintEn: 'Bronze, Silver, Gold…' },
  { word: 'GOLD', hintRu: 'Третья лига', hintEn: 'The third league' },
  { word: 'LORD', hintRu: 'Самая высокая лига', hintEn: 'The highest league' },
  { word: 'TURBO', hintRu: 'Буст ×5 на 20 секунд', hintEn: 'The ×5 boost for 20 seconds' },
  { word: 'ENERGY', hintRu: 'Тратится на каждый тап (по-английски)', hintEn: 'Every tap spends it' },
  { word: 'COMBO', hintRu: 'Три карточки дня', hintEn: 'Three cards of the day' },
  { word: 'CIPHER', hintRu: 'То, что вы сейчас разгадываете', hintEn: 'What you are solving right now' },
  { word: 'FRIEND', hintRu: 'Друг (по-английски)', hintEn: 'Invite one for a bonus' },
  { word: 'OFFICE', hintRu: 'Главный экран игры (по-английски)', hintEn: 'The main screen of the game' },
  { word: 'MASCOT', hintRu: 'Талисман компании (по-английски)', hintEn: 'The company’s character' },
  { word: 'CATNIP', hintRu: 'Кошачья мята (по-английски)', hintEn: 'The herb cats go crazy for' },
  { word: 'SALMON', hintRu: 'Розовая рыба (по-английски)', hintEn: 'A pink fish' },
  { word: 'TREAT', hintRu: 'Вкусняшка (по-английски)', hintEn: 'A tasty reward' },
  { word: 'NINE', hintRu: 'Сколько жизней у кота (по-английски)', hintEn: 'How many lives a cat has' },
  {
    word: 'NIGHT',
    hintRu: 'Когда коты особенно активны (по-английски)',
    hintEn: 'When cats are most active',
  },
  {
    word: 'SOFA',
    hintRu: 'Его точат, когда нет когтеточки (по-английски)',
    hintEn: 'Scratched when there is no post',
  },
  {
    word: 'WINDOW',
    hintRu: 'Отсюда кот смотрит на птиц (по-английски)',
    hintEn: 'Where a cat watches birds',
  },
  {
    word: 'BIRD',
    hintRu: 'За ней кот наблюдает в окно (по-английски)',
    hintEn: 'What a cat watches out of the window',
  },
  { word: 'SUNBEAM', hintRu: 'Солнечный луч, лучшее место для сна', hintEn: 'The best place for a nap' },
  { word: 'PILLOW', hintRu: 'Подушка (по-английски)', hintEn: 'Soft and always occupied by the cat' },
  { word: 'JUMP', hintRu: 'Прыжок (по-английски)', hintEn: 'What a cat does to reach the shelf' },
  { word: 'HUNT', hintRu: 'Охота (по-английски)', hintEn: 'What cats do at 3 am' },
  { word: 'STRIPE', hintRu: 'Полоска (по-английски)', hintEn: 'A tabby has many of them' },
  { word: 'BLACK', hintRu: 'Цвет нашего CEO (по-английски)', hintEn: 'The colour of our CEO' },
  { word: 'LUCKY', hintRu: 'Удачливый (по-английски)', hintEn: 'What a black cat brings' },
  { word: 'MAGIC', hintRu: 'Магия (по-английски)', hintEn: 'What cats have plenty of' },
  { word: 'ZOOMIES', hintRu: 'Внезапные ночные забеги кота (жаргон)', hintEn: 'Sudden midnight sprints' },
];

/** Награды шифра и комбо — в rewards.ts. */
export const CIPHER_WORD_RE = /^[A-Z]{4,7}$/;
