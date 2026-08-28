# mcmux

Инструмент командной строки, который позволяет писать код Minecraft-мода
**один раз** и собирать его под разные загрузчики (Fabric / Forge / NeoForge
/ Quilt) и разные версии Minecraft из одного исходного дерева.

Решает именно эту задачу: "пишу под Fabric — хочу так же собрать под Forge",
"пишу под 1.19.1 — хочу собрать ещё и под 1.20.1 (и наоборот)".

## Как это работает

1. **Общая логика** мода живёт в папке `common/` в виде обычного Java-кода.
   Всё, что реально различается между загрузчиками (регистрация,
   окружение, network), спрятано за маленьким интерфейсом
   `IPlatformHelper`, который каждый загрузчик реализует у себя
   (`fabric/`, `forge/`, `neoforge/`) и подключает через
   `java.util.ServiceLoader`. Это стандартный, проверенный временем паттерн
   ("multi-loader template"), а не изобретённая велосипедом магия.
2. **Различия между версиями Minecraft** внутри одного файла помечаются
   директивами препроцессора `//? if ... { ... }` (см. ниже). При генерации
   под конкретную версию лишние ветки просто вырезаются.
3. Команда `mcmux generate` берёт `common/` + нужный `<loader>/`, прогоняет
   через препроцессор с учётом выбранной версии/загрузчика и кладёт
   **обычный, ничем не примечательный** Fabric/Forge/NeoForge Gradle-проект
   в `build/mcmux/<version>-<loader>/`. Никакой кросс-платформенной магии в
   самом Gradle-файле нет — mcmux просто заранее "разворачивает" исходники,
   а дальше это уже привычный ForgeGradle/Loom/NeoGradle проект.
4. `mcmux build` делает то же самое и сразу запускает `gradle build` в
   сгенерированной директории.

Важно понимать границы инструмента: mcmux **не переводит** Fabric-код в
Forge-код и наоборот — Fabric API и Forge API отличаются достаточно сильно
(регистрации, события, сеть), чтобы это нельзя было делать надёжно
автоматически. Он берёт на себя рутину (структура проекта, Gradle-файлы,
условная компиляция по версиям, сборка нескольких целей одной командой) и
даёт понятное место (`IPlatformHelper`), куда положить единственный кусок
кода, который действительно нужно написать отдельно для каждого загрузчика.
Команда `mcmux migrate` помогает понять, какая часть уже существующего мода
не зависит от загрузчика и может просто переехать в `common/` как есть.

## Установка

```bash
cd mcmux   # эта директория
npm link   # или просто вызывайте bin/mcmux.js напрямую
```

Зависимостей у самого mcmux нет (чистый Node.js, `node >= 18`).
Для сборки сгенерированных проектов нужны: JDK (см. `docs/VERSIONS.md` —
какой JDK для какой версии Minecraft) и Gradle (или используйте gradle
wrapper внутри самого мод-проекта, если вы его туда добавите).

## Быстрый старт

```bash
mcmux init examplemod --package com.example.examplemod --loaders fabric,forge

mcmux target add 1.19.1 fabric \
  --loader-version 0.14.21 \
  --yarn 1.19.1+build.3 \
  --fabric-api 0.58.0+1.19.1

mcmux target add 1.20.1 forge --loader-version 47.2.0

mcmux doctor        # проверка окружения и конфигурации
mcmux generate      # разворачивает оба проекта в build/mcmux/
mcmux build         # то же самое + запускает gradle build для каждой цели
```

После этого у вас в `build/mcmux/` будет два независимых, готовых к сборке
Gradle-проекта: `1.19.1-fabric/` и `1.20.1-forge/` — из одного и того же
`common/`.

## Сценарий "пишу на Fabric, хочу собрать под Forge"

```bash
mcmux init mymod --loaders fabric
# ... пишете мод, common/ + fabric/ ...
mcmux loader add forge
# в forge/ появится каркас (entrypoint, platform helper) —
# перенесите туда loader-специфичную логику из fabric/,
# опираясь на common/ как на источник истины.
mcmux target add 1.20.1 forge --loader-version 47.2.0
mcmux build --target 1.20.1:forge
```

Если у вас уже есть существующий Fabric-мод не на mcmux, начните с:

```bash
mcmux migrate path/to/existing/src --out MIGRATION_TODO.md
```

— отчёт покажет, какие файлы не используют Fabric-specific импорты (их
можно сразу переносить в `common/`) и какие завязаны на Fabric API (их
нужно переписать под `IPlatformHelper`/собственный entrypoint в каждом
загрузчике).

## Сценарий "пишу под 1.19.1, хочу собрать под более новую версию"

В `common/` пометьте отличающийся код директивами препроцессора:

```java
//? if >=1.20 {
registry.register(BOTH_SIDED_KEY, MyBlock::new);
//?} else {
registry.register(MyBlock::new);
//?}
```

Дальше просто добавьте вторую цель:

```bash
mcmux target add 1.21 fabric --loader-version <версия> --yarn <mappings> --fabric-api <версия>
mcmux build --target 1.21:fabric
```

Обе версии соберутся из одного и того же файла — правильная ветка
выбирается автоматически.

## Синтаксис препроцессора версий

Работает в любом файле, где `//` — это комментарий (`.java`, `.kts`, ...):

```
//? if <условие> {
... код, если условие истинно ...
//?} else if <условие> {
...
//?} else {
...
//?}
```

Условие — это токены через пробел (пробел = И), с `!` для отрицания:

| Токен            | Значение                                  |
|------------------|--------------------------------------------|
| `fabric`, `forge`, `neoforge`, `quilt` | сравнение с текущим загрузчиком |
| `1.20.1`, `==1.20.1` | версия Minecraft равна              |
| `>=1.20`, `<1.21`, `>1.19.1`, `<=1.20.4` | сравнение версий         |
| `!fabric`        | НЕ Fabric                                 |

Пример: `//? if fabric >=1.20 {` — истинно только для Fabric на 1.20+.

Директивы всегда вырезаются из результата, остаётся только тело выбранной
ветки — то есть после `mcmux generate` в коде не остаётся ни `//?`, ни
`{{плейсхолдеров}}` (это проверяется автотестами, см. `test/e2e.test.js`).

## Команды

```
mcmux init <modId> [--name "..."] [--package com.example.mod] [--loaders fabric,forge]
mcmux loader add <fabric|forge|neoforge|quilt>
mcmux loader list
mcmux target add <mc_version> <loader> [--java N] [--loader-version V] [--yarn V] [--fabric-api V]
mcmux target list
mcmux target remove <mc_version> <loader>
mcmux generate [--target <mc_version>:<loader>]
mcmux build [--target <mc_version>:<loader>] [--gradle-cmd gradle] [--generate-only]
mcmux migrate <путь_к_src> [--out MIGRATION_TODO.md]
mcmux doctor
```

## Структура проекта, который создаёт `mcmux init`

```
mymod/
  mcmux.config.json        # список загрузчиков и целей сборки
  common/
    src/main/java/.../     # общая логика, //? директивы, IPlatformHelper
  fabric/
    build.gradle.kts.tmpl  # шаблон, версии подставляются при generate
    src/main/java/.../fabric/FabricModEntry.java
    src/main/java/.../platform/FabricPlatformHelper.java
    src/main/resources/fabric.mod.json.tmpl
  forge/                   # аналогично, если добавлен
  build/mcmux/<version>-<loader>/   # generate-артефакты, НЕ редактировать руками
```

Файлы внутри `build/mcmux/` перезаписываются при каждом `generate`/`build` —
редактируйте только `common/` и `<loader>/` в корне проекта.

## Ограничения (честно)

- mcmux не скачивает и не проверяет актуальные версии Fabric/Forge/NeoForge/
  Yarn-mappings — эти значения вы указываете сами при `mcmux target add`
  (см. `docs/VERSIONS.md`, где написано, где их искать). `mcmux doctor`
  подсвечивает незаполненные поля.
- Сгенерированные `build.gradle.kts` — это типовые, best-effort шаблоны;
  ForgeGradle/NeoGradle DSL время от времени меняется между релизами,
  сверяйтесь с официальной документацией загрузчика, если сборка не идёт.
- `mcmux migrate` — это отчёт-подсказка (эвристика по импортам), а не
  автоматический переносчик кода.
- Реальный `gradle build` требует доступа в интернет (Mojang/Fabric/Forge/
  NeoForge maven-репозитории) и там же должен быть проверен — mcmux этого
  не делает и не может гарантировать успешную сборку без сети.

## Тесты

```bash
npm test
```
