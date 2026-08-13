export const CLUES = {
  sketch_motif: {
    id: "sketch_motif",
    title: "Навязчивый мотив",
    short: "Катерина снова нарисовала ту же геометрию, не планируя этого.",
    detail: "Для неё это пока просто раздражающая привычка руки, а не мистика.",
    icon: "sketch"
  },
  cordon_symbol: {
    id: "cordon_symbol",
    title: "Знак за лентой",
    short: "Форма на мокром асфальте совпадает с ритмом из старого эскиза.",
    detail: "Катерина замечает его с безопасной стороны оцепления и не трогает ничего на месте.",
    icon: "seal"
  },
  echo_voice: {
    id: "echo_voice",
    title: "Обрывок голоса",
    short: "В Эхе прозвучало чужое предупреждение, но слова распались раньше смысла.",
    detail: "Катерина запомнила голос лучше изображения.",
    icon: "voice"
  },
  echo_hand: {
    id: "echo_hand",
    title: "Чужая ладонь",
    short: "В Эхе рука скользнула по кирпичу, будто искала опору.",
    detail: "Катерина запомнила движение и чувство паники.",
    icon: "hand"
  },
  echo_shape: {
    id: "echo_shape",
    title: "Ломаная геометрия",
    short: "В Эхе знак на мгновение выглядел не рисунком, а чем-то открывающимся.",
    detail: "Катерина удержала форму, но не её значение.",
    icon: "seal"
  },
  tattoo_response: {
    id: "tattoo_response",
    title: "Ответ на коже",
    short: "Дома одна линия татуировки снова засветилась в ответ на воспоминание о знаке.",
    detail: "Это уже невозможно списать на отражение или стресс.",
    icon: "tattoo"
  },
  sofia_photo: {
    id: "sofia_photo",
    title: "Фото из городского поста",
    short: "Софья прислала публичное фото того же знака и узнала в нём мотив Катерины.",
    detail: "Софья не просит лезть в дело — она просто спрашивает, почему чужой знак похож на рисунки подруги.",
    icon: "phone"
  }
};

export const EVIDENCE_LINKS = {
  sketch_symbol: {
    id: "sketch_symbol",
    a: "sketch_motif",
    b: "cordon_symbol",
    label: "Сопоставить эскиз и знак",
    result: "Катерина рисовала эту геометрию до того, как увидела её во дворе."
  },
  symbol_tattoo: {
    id: "symbol_tattoo",
    a: "cordon_symbol",
    b: "tattoo_response",
    label: "Связать знак с реакцией татуировки",
    result: "Татуировка реагирует именно на этот рисунок, а не просто на стресс после Эха."
  },
  photo_sketch: {
    id: "photo_sketch",
    a: "sofia_photo",
    b: "sketch_motif",
    label: "Сравнить фото Софьи со старым эскизом",
    result: "Совпадение замечает уже не только Катерина: мотив узнаваем со стороны."
  }
};

export const SCENES = {
  menu: {
    id: "menu",
    mode: "menu",
    location: "Северин",
    time: "22:38",
    chapter: "Пролог: Чужая кожа",
    title: "Эхо семи печатей",
    kicker: "романтический мистический триллер",
    copy: [
      "Катерина рисует одни и те же линии годами и считает это дурной привычкой.",
      "Сегодня ночью город покажет ей этот рисунок первым."
    ],
    actions: [{ id: "game.start", label: "Начать пролог", kind: "primary" }]
  },

  studio: {
    id: "studio",
    mode: "story",
    location: "Тату-студия · Северин",
    time: "22:41",
    title: "Последний эскиз на сегодня",
    copy: [
      "За стеклом студии дождь размазывает трамвайные огни. Последний клиент ушёл двадцать минут назад, Елена — ещё раньше.",
      "Катерина дописывает эскиз для завтрашней записи и замечает в углу листа знакомую ломаную форму. Она снова появилась сама собой."
    ],
    actions: [
      { id: "studio.inspect_sketch", label: "Рассмотреть то, что нарисовала рука", kind: "quiet" },
      { id: "studio.close", label: "Закрыть студию и идти домой", kind: "primary", requiresFlag: "sketch_seen" }
    ]
  },

  walk: {
    id: "walk",
    mode: "story",
    location: "Старый квартал",
    time: "23:03",
    title: "Обычная дорога домой",
    copy: [
      "Кощей наверняка уже сидит у миски с видом человека, которого предали. Катерина ускоряет шаг и прячет руки в карманы пальто.",
      "Впереди двор подсвечен синим. Скорая уезжает, полицейский сворачивает часть ленты, прохожие расходятся. Это не её дело — просто её обычный путь домой проходит здесь."
    ],
    actions: [{ id: "walk.continue", label: "Пройти мимо и не задерживаться", kind: "primary" }]
  },

  cordon: {
    id: "cordon",
    mode: "story",
    location: "Проходной двор",
    time: "23:06",
    title: "Блик на мокром асфальте",
    copy: [
      "Катерина остаётся по эту сторону ленты. Ей не нужен чужой кошелёк, кровь или очередная история для городского паблика.",
      "Но в луже за лентой свет цепляется за тонкие линии. Та же геометрия, что час назад появилась на её эскизе. Под рукавом внезапно обжигает кожа."
    ],
    actions: [{ id: "cordon.notice_symbol", label: "Всмотреться в знакомую форму", kind: "mystic" }]
  },

  echo: {
    id: "echo",
    mode: "echo",
    location: "Не здесь · не сейчас",
    time: "—",
    title: "Мир на секунду становится чужим",
    copy: [
      "Цвет проваливается первым. Потом звук. Катерина не вызывает это и даже не понимает, как прекратить.",
      "Чужой страх накрывает быстрее мысли. Нужно удержать хоть одну деталь, пока всё не распалось."
    ],
    actions: [
      { id: "echo.focus.voice", label: "Удержать голос", kind: "choice", unlessFlag: "echo_focused" },
      { id: "echo.focus.hand", label: "Смотреть на чужую руку", kind: "choice", unlessFlag: "echo_focused" },
      { id: "echo.focus.shape", label: "Запомнить геометрию", kind: "choice", unlessFlag: "echo_focused" },
      { id: "echo.break", label: "Оттолкнуться от воспоминания", kind: "primary", requiresFlag: "echo_focused" }
    ]
  },

  egor: {
    id: "egor",
    mode: "dialogue",
    location: "Проходной двор",
    time: "23:09",
    title: "Человек, который понял слишком быстро",
    speaker: "Егор",
    dialogue: "Если линия на руке всё ещё горит — не трогай её. И домой иди не через набережную.",
    copy: [
      "Катерина приходит в себя, держась за мокрую стену уже на своей стороне ленты. Рядом стоит незнакомый мужчина — не спаситель и не полицейский.",
      "Самое неприятное в нём не бледная кожа и не холодные голубые глаза. Самое неприятное — он говорит так, будто знает, что только что произошло."
    ],
    actions: [
      { id: "egor.direct", label: "«Откуда ты знаешь про мою руку?»", tone: "direct", unlessFlag: "egor_exchanged" },
      { id: "egor.sarcastic", label: "«Отлично. Ещё один человек с советами, которых я не просила.»", tone: "sarcastic", unlessFlag: "egor_exchanged" },
      { id: "egor.guarded", label: "Ничего не подтверждать. Спросить, кто он.", tone: "guarded", unlessFlag: "egor_exchanged" },
      { id: "scene.go_home", label: "Уйти домой", kind: "primary", requiresFlag: "egor_exchanged" }
    ]
  },

  home: {
    id: "home",
    mode: "home",
    location: "Квартира Катерины",
    time: "23:34",
    title: "Нормальность держится ещё пару минут",
    copy: [
      "Кощей встречает её у двери, обвиняюще смотрит на пустую миску и немедленно садится на куртку. Обычный кот. Обычная квартира. Именно этого Катерине сейчас и не хватало.",
      "Она моет руки, ставит чайник и почти убеждает себя, что во дворе случилась паническая атака. Потом под ключицей снова начинает светиться тонкая линия."
    ],
    actions: [
      { id: "home.check_tattoo", label: "Проверить светящуюся линию", kind: "mystic", unlessFlag: "cat_spoke" },
      { id: "koshchey.disbelief", label: "«Ты сейчас сказал?..»", tone: "direct", requiresFlag: "cat_spoke", unlessFlag: "cat_exchanged" },
      { id: "koshchey.sarcastic", label: "«Конечно. Почему бы коту не начать говорить.»", tone: "sarcastic", requiresFlag: "cat_spoke", unlessFlag: "cat_exchanged" },
      { id: "koshchey.careful", label: "Отойти. «Что ты такое?»", tone: "guarded", requiresFlag: "cat_spoke", unlessFlag: "cat_exchanged" },
      { id: "phone.open", label: "Открыть новое сообщение Софьи", kind: "primary", requiresFlag: "cat_exchanged", unlessFlag: "sofia_replied" },
      { id: "desk.open", label: "Разложить всё на рабочем столе", kind: "primary", requiresFlag: "sofia_replied" },
      { id: "scene.finish", label: "Оставить записи до утра", kind: "quiet", requiresFlag: "thought_confirmed" }
    ]
  },

  ending: {
    id: "ending",
    mode: "ending",
    location: "Квартира Катерины",
    time: "00:02",
    title: "Это не новый рисунок",
    copy: [
      "Софья присылает ещё одно обновление из городского канала. На увеличенном фото пропавшей девушки виден свежий фрагмент той же геометрии на коже.",
      "Кощей долго смотрит на экран, потом на Катерину. «Это не твой рисунок, Катя. Ты его вспоминаешь.»"
    ],
    actions: [{ id: "game.restart", label: "Пройти пролог ещё раз", kind: "primary" }]
  }
};

export const PHONE_THREADS = [{
  id: "sofia",
  name: "Софья",
  time: "23:41",
  messages: [
    "Кать, ты дома?",
    "Я сейчас увидела пост про девушку из старого квартала. Там фотка со странным знаком.",
    "Это не та фигня, которую ты вечно рисуешь на полях? Я серьёзно."
  ]
}];
