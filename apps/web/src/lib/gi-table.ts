/**
 * Table d'index glycémique (IG) d'aliments courants. Référence glucose = 100.
 *
 * Sources :
 *  - Atkinson FS, Foster-Powell K, Brand-Miller JC. International Tables of Glycemic Index
 *    and Glycemic Load Values: 2008. Diabetes Care 31(12):2281-2283.
 *  - Atkinson FS et al. International tables of glycemic index and glycemic load values 2021:
 *    a systematic review. Am J Clin Nutr 114(5):1625-1632.
 *  - Foster-Powell K, Holt SHA, Brand-Miller JC. International table of glycemic index and
 *    glycemic load values: 2002. Am J Clin Nutr 76(1):5-56.
 *
 * Les valeurs sont des moyennes arrondies : l'IG réel varie selon la variété, la cuisson,
 * la maturité et ce qui est mangé avec. Elles sont affichées comme repères, pas comme mesures.
 * Catégories : bas < 55, moyen 55-69, haut >= 70.
 */
import type { GiCategory } from '@/db/types';

export type GiGroup =
  | 'bread' | 'rice' | 'pasta' | 'potato' | 'cereal' | 'grain' | 'legume' | 'fruit'
  | 'vegetable' | 'dairy' | 'drink' | 'sweet' | 'snack' | 'spread';

export interface GiFood {
  id: string;
  name: string;
  gi: number;
  group: GiGroup;
  /** Tags de catégories Open Food Facts qui correspondent à cet aliment. */
  off: string[];
  /** Mots-clés (minuscules, sans accent) pour retrouver l'aliment par son nom. */
  keys: string[];
}

type Row = [id: string, name: string, gi: number, group: GiGroup, off?: string[], keys?: string[]];

const ROWS: Row[] = [
  // Pains
  ['baguette', 'Baguette blanche', 75, 'bread', ['en:baguettes'], ['baguette']],
  ['white-bread', 'Pain blanc', 75, 'bread', ['en:white-breads'], ['pain blanc']],
  ['sandwich-bread', 'Pain de mie blanc', 75, 'bread', ['en:sliced-breads', 'en:white-sliced-breads'], ['pain de mie']],
  ['wholemeal-bread', 'Pain complet', 71, 'bread', ['en:wholemeal-breads', 'en:whole-wheat-breads'], ['pain complet']],
  ['wholemeal-sandwich', 'Pain de mie complet', 68, 'bread', ['en:wholemeal-sliced-breads'], ['pain de mie complet']],
  ['multigrain-bread', 'Pain aux céréales', 53, 'bread', ['en:cereal-breads', 'en:multigrain-breads'], ['pain aux cereales', 'pain multicereales']],
  ['sourdough-bread', 'Pain au levain', 54, 'bread', ['en:sourdough-breads'], ['pain au levain']],
  ['rye-bread', 'Pain de seigle', 58, 'bread', ['en:rye-breads'], ['pain de seigle']],
  ['pumpernickel', 'Pain noir (pumpernickel)', 50, 'bread', ['en:pumpernickel'], ['pumpernickel', 'pain noir']],
  ['pita', 'Pain pita', 57, 'bread', ['en:pita-breads'], ['pita']],
  ['bagel', 'Bagel', 72, 'bread', ['en:bagels'], ['bagel']],
  ['burger-bun', 'Pain burger', 61, 'bread', ['en:hamburger-buns'], ['pain burger', 'bun']],
  ['tortilla-wheat', 'Tortilla de blé', 30, 'bread', ['en:wheat-tortillas', 'en:tortillas'], ['tortilla', 'wrap']],
  ['naan', 'Naan', 71, 'bread', ['en:naans'], ['naan']],
  ['rusk', 'Biscotte', 70, 'bread', ['en:rusks'], ['biscotte']],
  ['crispbread', 'Pain suédois / craquant', 64, 'bread', ['en:crispbreads'], ['pain suedois', 'wasa', 'cracotte']],
  ['rice-cake', 'Galette de riz soufflé', 82, 'bread', ['en:puffed-rice-cakes', 'en:rice-cakes'], ['galette de riz']],
  ['brioche', 'Brioche', 70, 'bread', ['en:brioches'], ['brioche']],
  ['croissant', 'Croissant', 67, 'bread', ['en:croissants'], ['croissant']],
  ['pain-au-chocolat', 'Pain au chocolat', 65, 'bread', ['en:chocolate-croissants', 'en:pains-au-chocolat'], ['pain au chocolat', 'chocolatine']],
  // Riz et céréales en grains
  ['white-rice', 'Riz blanc', 73, 'rice', ['en:white-rices', 'en:long-grain-rices'], ['riz blanc', 'riz']],
  ['basmati-rice', 'Riz basmati', 58, 'rice', ['en:basmati-rices'], ['riz basmati', 'basmati']],
  ['brown-rice', 'Riz complet', 68, 'rice', ['en:brown-rices', 'en:whole-grain-rices'], ['riz complet', 'riz brun']],
  ['jasmine-rice', 'Riz thaï (jasmin)', 89, 'rice', ['en:jasmine-rices', 'en:thai-rices'], ['riz thai', 'riz jasmin']],
  ['parboiled-rice', 'Riz étuvé', 47, 'rice', ['en:parboiled-rices'], ['riz etuve']],
  ['sticky-rice', 'Riz gluant', 87, 'rice', ['en:glutinous-rices'], ['riz gluant']],
  ['wild-rice', 'Riz sauvage', 57, 'rice', ['en:wild-rices'], ['riz sauvage']],
  ['risotto-rice', 'Riz arborio (risotto)', 69, 'rice', ['en:arborio-rices', 'en:risotto-rices'], ['risotto', 'arborio']],
  ['sushi-rice', 'Riz à sushi', 85, 'rice', ['en:sushi-rices'], ['sushi', 'maki']],
  ['quinoa', 'Quinoa', 53, 'grain', ['en:quinoa', 'en:quinoas'], ['quinoa']],
  ['bulgur', 'Boulgour', 47, 'grain', ['en:bulgur', 'en:bulgurs'], ['boulgour', 'bulgur']],
  ['couscous', 'Semoule de couscous', 65, 'grain', ['en:couscous', 'en:wheat-semolinas'], ['couscous', 'semoule']],
  ['pearl-barley', 'Orge perlé', 28, 'grain', ['en:pearl-barley', 'en:barley'], ['orge']],
  ['buckwheat', 'Sarrasin', 50, 'grain', ['en:buckwheat'], ['sarrasin', 'kasha']],
  ['millet', 'Millet', 71, 'grain', ['en:millet'], ['millet']],
  ['polenta', 'Polenta', 68, 'grain', ['en:polentas'], ['polenta']],
  ['sweet-corn', 'Maïs doux', 52, 'grain', ['en:sweet-corn', 'en:canned-sweet-corn'], ['mais']],
  ['ebly', 'Blé précuit', 50, 'grain', ['en:pre-cooked-wheat', 'en:wheat'], ['ble', 'ebly']],
  // Pâtes
  ['pasta', 'Pâtes blanches (al dente)', 49, 'pasta', ['en:pastas', 'en:dry-pastas', 'en:spaghetti', 'en:penne', 'en:macaroni', 'en:fusilli'], ['pates', 'spaghetti', 'penne', 'macaroni', 'fusilli', 'tagliatelle', 'coquillettes']],
  ['wholemeal-pasta', 'Pâtes complètes', 42, 'pasta', ['en:whole-wheat-pastas', 'en:wholemeal-pastas'], ['pates completes']],
  ['overcooked-pasta', 'Pâtes très cuites', 61, 'pasta', [], ['pates bien cuites']],
  ['egg-pasta', 'Pâtes aux œufs', 40, 'pasta', ['en:egg-pastas'], ['pates aux oeufs']],
  ['gnocchi', 'Gnocchi', 68, 'pasta', ['en:gnocchi'], ['gnocchi']],
  ['ravioli', 'Ravioli', 39, 'pasta', ['en:ravioli'], ['ravioli']],
  ['rice-noodles', 'Nouilles de riz', 61, 'pasta', ['en:rice-noodles'], ['nouilles de riz', 'vermicelles de riz']],
  ['instant-noodles', 'Nouilles instantanées', 52, 'pasta', ['en:instant-noodles'], ['nouilles instantanees', 'ramen']],
  ['udon', 'Nouilles udon', 55, 'pasta', ['en:udon'], ['udon']],
  ['soba', 'Nouilles soba', 46, 'pasta', ['en:soba'], ['soba']],
  ['glass-noodles', 'Vermicelles de soja', 39, 'pasta', ['en:glass-noodles', 'en:mung-bean-noodles'], ['vermicelles de soja']],
  // Pommes de terre
  ['boiled-potato', 'Pomme de terre vapeur', 78, 'potato', ['en:potatoes'], ['pomme de terre', 'patate']],
  ['mashed-potato', 'Purée de pommes de terre', 87, 'potato', ['en:mashed-potatoes', 'en:instant-mashed-potatoes'], ['puree']],
  ['baked-potato', 'Pomme de terre au four', 85, 'potato', [], ['pomme de terre au four']],
  ['fries', 'Frites', 63, 'potato', ['en:french-fries', 'en:frozen-fries'], ['frites']],
  ['new-potato', 'Pomme de terre nouvelle', 62, 'potato', ['en:new-potatoes'], ['pomme de terre nouvelle', 'grenaille']],
  ['sweet-potato', 'Patate douce', 63, 'potato', ['en:sweet-potatoes'], ['patate douce']],
  ['crisps', 'Chips de pomme de terre', 56, 'snack', ['en:potato-crisps', 'en:crisps', 'en:chips-and-fries'], ['chips']],
  ['cold-potato', 'Pomme de terre refroidie (salade)', 56, 'potato', ['en:potato-salads'], ['salade de pommes de terre']],
  // Céréales du petit-déjeuner
  ['cornflakes', 'Corn flakes', 81, 'cereal', ['en:corn-flakes'], ['corn flakes', 'cornflakes']],
  ['puffed-rice-cereal', 'Riz soufflé', 87, 'cereal', ['en:puffed-rice'], ['riz souffle', 'rice krispies']],
  ['chocolate-cereal', 'Céréales chocolatées', 77, 'cereal', ['en:chocolate-cereals'], ['cereales chocolat', 'coco pops', 'chocapic']],
  ['honey-cereal', 'Céréales au miel', 74, 'cereal', ['en:cereals-with-honey'], ['cereales au miel']],
  ['bran-flakes', 'Pétales de son', 74, 'cereal', ['en:bran-flakes'], ['petales de son']],
  ['all-bran', 'Céréales de son (type All-Bran)', 44, 'cereal', ['en:bran-cereals'], ['all-bran', 'all bran']],
  ['muesli', 'Muesli sans sucre ajouté', 57, 'cereal', ['en:mueslis'], ['muesli']],
  ['granola', 'Granola croustillant', 62, 'cereal', ['en:crunchy-mueslis', 'en:granolas'], ['granola']],
  ['porridge', "Flocons d'avoine (porridge)", 55, 'cereal', ['en:rolled-oats', 'en:oat-flakes', 'en:porridge'], ['flocons d avoine', 'porridge', 'avoine']],
  ['instant-oats', "Flocons d'avoine instantanés", 79, 'cereal', ['en:instant-porridge'], ['avoine instantane']],
  ['weetabix', 'Biscuits de blé complet (type Weetabix)', 69, 'cereal', ['en:wheat-biscuits-cereals'], ['weetabix']],
  ['special-k', 'Pétales riz et blé (type Special K)', 69, 'cereal', [], ['special k']],
  ['breakfast-cereals', 'Céréales du petit-déjeuner (moyenne)', 70, 'cereal', ['en:breakfast-cereals'], ['cereales']],
  // Légumineuses
  ['lentils', 'Lentilles vertes', 32, 'legume', ['en:lentils', 'en:green-lentils'], ['lentilles']],
  ['red-lentils', 'Lentilles corail', 26, 'legume', ['en:red-lentils'], ['lentilles corail']],
  ['chickpeas', 'Pois chiches', 28, 'legume', ['en:chickpeas'], ['pois chiches']],
  ['kidney-beans', 'Haricots rouges', 24, 'legume', ['en:red-kidney-beans', 'en:kidney-beans'], ['haricots rouges']],
  ['white-beans', 'Haricots blancs', 31, 'legume', ['en:white-beans', 'en:haricot-beans'], ['haricots blancs', 'flageolets']],
  ['black-beans', 'Haricots noirs', 30, 'legume', ['en:black-beans'], ['haricots noirs']],
  ['baked-beans', 'Haricots à la tomate', 48, 'legume', ['en:baked-beans'], ['baked beans']],
  ['split-peas', 'Pois cassés', 32, 'legume', ['en:split-peas'], ['pois casses']],
  ['green-peas', 'Petits pois', 51, 'legume', ['en:green-peas', 'en:peas'], ['petits pois']],
  ['soybeans', 'Soja (graines)', 16, 'legume', ['en:soybeans'], ['soja', 'edamame']],
  ['hummus', 'Houmous', 6, 'legume', ['en:hummus'], ['houmous', 'hummus']],
  ['broad-beans', 'Fèves', 79, 'legume', ['en:broad-beans'], ['feves']],
  // Fruits
  ['apple', 'Pomme', 36, 'fruit', ['en:apples'], ['pomme']],
  ['banana', 'Banane', 51, 'fruit', ['en:bananas'], ['banane']],
  ['ripe-banana', 'Banane très mûre', 62, 'fruit', [], ['banane mure']],
  ['orange', 'Orange', 43, 'fruit', ['en:oranges'], ['orange']],
  ['clementine', 'Clémentine', 47, 'fruit', ['en:clementines', 'en:mandarins'], ['clementine', 'mandarine']],
  ['grapes', 'Raisin', 59, 'fruit', ['en:grapes'], ['raisin']],
  ['strawberry', 'Fraises', 40, 'fruit', ['en:strawberries'], ['fraise']],
  ['pear', 'Poire', 38, 'fruit', ['en:pears'], ['poire']],
  ['peach', 'Pêche', 42, 'fruit', ['en:peaches'], ['peche', 'nectarine']],
  ['apricot', 'Abricot', 34, 'fruit', ['en:apricots'], ['abricot']],
  ['cherries', 'Cerises', 22, 'fruit', ['en:cherries'], ['cerise']],
  ['plum', 'Prune', 39, 'fruit', ['en:plums'], ['prune']],
  ['kiwi', 'Kiwi', 50, 'fruit', ['en:kiwis', 'en:kiwifruits'], ['kiwi']],
  ['mango', 'Mangue', 51, 'fruit', ['en:mangoes'], ['mangue']],
  ['pineapple', 'Ananas', 59, 'fruit', ['en:pineapples'], ['ananas']],
  ['watermelon', 'Pastèque', 76, 'fruit', ['en:watermelons'], ['pasteque']],
  ['melon', 'Melon', 65, 'fruit', ['en:melons', 'en:cantaloupes'], ['melon']],
  ['grapefruit', 'Pamplemousse', 25, 'fruit', ['en:grapefruits'], ['pamplemousse']],
  ['blueberries', 'Myrtilles', 53, 'fruit', ['en:blueberries'], ['myrtille']],
  ['raspberries', 'Framboises', 32, 'fruit', ['en:raspberries'], ['framboise']],
  ['dates', 'Dattes', 42, 'fruit', ['en:dates'], ['datte']],
  ['raisins', 'Raisins secs', 64, 'fruit', ['en:raisins'], ['raisins secs']],
  ['dried-apricots', 'Abricots secs', 30, 'fruit', ['en:dried-apricots'], ['abricots secs']],
  ['prunes', 'Pruneaux', 29, 'fruit', ['en:prunes'], ['pruneau']],
  ['dried-figs', 'Figues sèches', 61, 'fruit', ['en:dried-figs'], ['figues seches']],
  ['applesauce', 'Compote de pomme sans sucre ajouté', 35, 'fruit', ['en:apple-compotes', 'en:compotes'], ['compote']],
  ['fruit-in-syrup', 'Fruits au sirop', 58, 'fruit', ['en:fruits-in-syrup'], ['fruits au sirop']],
  // Légumes
  ['carrot-raw', 'Carottes crues', 16, 'vegetable', ['en:carrots'], ['carottes rapees', 'carotte crue']],
  ['carrot-cooked', 'Carottes cuites', 39, 'vegetable', [], ['carottes cuites', 'carotte']],
  ['beetroot', 'Betterave cuite', 64, 'vegetable', ['en:beetroots', 'en:cooked-beetroots'], ['betterave']],
  ['pumpkin', 'Potiron', 64, 'vegetable', ['en:pumpkins'], ['potiron', 'courge', 'potimarron']],
  ['parsnip', 'Panais', 52, 'vegetable', ['en:parsnips'], ['panais']],
  ['tomato-soup', 'Soupe de tomate', 38, 'vegetable', ['en:tomato-soups'], ['soupe de tomate']],
  ['vegetable-soup', 'Soupe de légumes', 48, 'vegetable', ['en:vegetable-soups'], ['soupe de legumes', 'veloute']],
  // Produits laitiers et alternatives
  ['milk', 'Lait demi-écrémé', 37, 'dairy', ['en:semi-skimmed-milks', 'en:milks'], ['lait']],
  ['whole-milk', 'Lait entier', 39, 'dairy', ['en:whole-milks'], ['lait entier']],
  ['plain-yogurt', 'Yaourt nature', 35, 'dairy', ['en:plain-yogurts'], ['yaourt nature']],
  ['fruit-yogurt', 'Yaourt aux fruits sucré', 41, 'dairy', ['en:fruit-yogurts', 'en:sweetened-yogurts'], ['yaourt aux fruits']],
  ['ice-cream', 'Crème glacée', 51, 'dairy', ['en:ice-creams', 'en:ice-creams-and-sorbets'], ['glace', 'creme glacee']],
  ['custard', 'Crème dessert', 43, 'dairy', ['en:dessert-creams', 'en:custards'], ['creme dessert', 'flan']],
  ['rice-pudding', 'Riz au lait', 65, 'dairy', ['en:rice-puddings'], ['riz au lait']],
  ['soy-milk', 'Boisson au soja', 34, 'dairy', ['en:soy-milks'], ['lait de soja', 'boisson soja']],
  ['oat-milk', "Boisson à l'avoine", 69, 'dairy', ['en:oat-milks'], ['lait d avoine', 'boisson avoine']],
  ['rice-milk', 'Boisson au riz', 86, 'dairy', ['en:rice-milks'], ['lait de riz', 'boisson riz']],
  ['chocolate-milk', 'Lait chocolaté', 40, 'dairy', ['en:chocolate-milks'], ['lait chocolate']],
  // Boissons
  ['cola', 'Soda cola', 63, 'drink', ['en:colas'], ['cola', 'coca']],
  ['soda', 'Soda sucré', 63, 'drink', ['en:sodas', 'en:sweetened-beverages', 'en:carbonated-drinks'], ['soda', 'limonade']],
  ['orange-soda', "Soda à l'orange", 68, 'drink', ['en:orange-soft-drinks'], ['fanta', 'orangina']],
  ['orange-juice', "Jus d'orange", 50, 'drink', ['en:orange-juices'], ['jus d orange']],
  ['apple-juice', 'Jus de pomme', 41, 'drink', ['en:apple-juices'], ['jus de pomme']],
  ['grape-juice', 'Jus de raisin', 48, 'drink', ['en:grape-juices'], ['jus de raisin']],
  ['pineapple-juice', "Jus d'ananas", 46, 'drink', ['en:pineapple-juices'], ['jus d ananas']],
  ['tomato-juice', 'Jus de tomate', 38, 'drink', ['en:tomato-juices'], ['jus de tomate']],
  ['multifruit-juice', 'Jus multifruits', 50, 'drink', ['en:multifruit-juices', 'en:fruit-juices'], ['jus multifruits', 'jus de fruits']],
  ['fruit-nectar', 'Nectar de fruits', 55, 'drink', ['en:fruit-nectars'], ['nectar']],
  ['sports-drink', "Boisson pour l'effort", 78, 'drink', ['en:sports-drinks', 'en:isotonic-drinks'], ['boisson isotonique', 'gatorade', 'powerade']],
  ['energy-drink', 'Boisson énergisante', 70, 'drink', ['en:energy-drinks'], ['boisson energisante', 'red bull', 'monster']],
  ['iced-tea', 'Thé glacé sucré', 55, 'drink', ['en:iced-teas'], ['the glace', 'ice tea']],
  ['smoothie', 'Smoothie de fruits', 44, 'drink', ['en:smoothies'], ['smoothie']],
  ['beer', 'Bière', 66, 'drink', ['en:beers'], ['biere']],
  // Sucreries, biscuits, pâtisseries
  ['sugar', 'Sucre blanc', 65, 'sweet', ['en:sugars', 'en:white-sugars'], ['sucre']],
  ['honey', 'Miel', 61, 'spread', ['en:honeys'], ['miel']],
  ['maple-syrup', "Sirop d'érable", 54, 'spread', ['en:maple-syrups'], ['sirop d erable']],
  ['agave-syrup', "Sirop d'agave", 15, 'spread', ['en:agave-syrups'], ['sirop d agave']],
  ['jam', 'Confiture', 49, 'spread', ['en:jams'], ['confiture']],
  ['hazelnut-spread', 'Pâte à tartiner chocolat-noisette', 33, 'spread', ['en:hazelnut-spreads', 'en:chocolate-spreads'], ['pate a tartiner', 'nutella']],
  ['milk-chocolate', 'Chocolat au lait', 43, 'sweet', ['en:milk-chocolates'], ['chocolat au lait']],
  ['dark-chocolate', 'Chocolat noir 70 %', 23, 'sweet', ['en:dark-chocolates'], ['chocolat noir']],
  ['white-chocolate', 'Chocolat blanc', 44, 'sweet', ['en:white-chocolates'], ['chocolat blanc']],
  ['chocolate-bar', 'Barre chocolatée caramel', 62, 'sweet', ['en:chocolate-bars', 'en:chocolate-candy-bars'], ['mars', 'barre chocolatee']],
  ['peanut-bar', 'Barre cacahuète-caramel', 51, 'sweet', [], ['snickers']],
  ['gummies', 'Bonbons gélifiés', 78, 'sweet', ['en:gummy-candies', 'en:gummies', 'en:candies'], ['bonbons', 'haribo']],
  ['jelly-beans', 'Dragées gélifiées', 78, 'sweet', ['en:jelly-beans'], ['jelly beans']],
  ['shortbread', 'Sablés', 64, 'sweet', ['en:shortbread-cookies'], ['sables']],
  ['butter-biscuit', 'Petit-beurre', 55, 'sweet', ['en:petit-beurre', 'en:dry-biscuits'], ['petit beurre', 'petit-beurre']],
  ['digestive', 'Biscuits type digestive', 59, 'sweet', ['en:digestive-biscuits'], ['digestive']],
  ['cookies', 'Cookies aux pépites de chocolat', 62, 'sweet', ['en:chocolate-chip-cookies', 'en:cookies'], ['cookie']],
  ['wafer', 'Gaufrettes', 77, 'sweet', ['en:wafers'], ['gaufrette']],
  ['sponge-cake', 'Génoise / gâteau de Savoie', 46, 'sweet', ['en:sponge-cakes'], ['genoise', 'gateau de savoie']],
  ['pound-cake', 'Quatre-quarts', 54, 'sweet', ['en:pound-cakes'], ['quatre-quarts', 'quatre quarts']],
  ['muffin', 'Muffin', 60, 'sweet', ['en:muffins'], ['muffin']],
  ['doughnut', 'Beignet / donut', 76, 'sweet', ['en:doughnuts'], ['donut', 'beignet']],
  ['waffle', 'Gaufre', 76, 'sweet', ['en:waffles'], ['gaufre']],
  ['pancake', 'Pancakes', 66, 'sweet', ['en:pancakes'], ['pancake']],
  ['crepe', 'Crêpe', 66, 'sweet', ['en:crepes'], ['crepe']],
  ['cereal-bar', 'Barre de céréales', 61, 'sweet', ['en:cereal-bars'], ['barre de cereales']],
  ['sorbet', 'Sorbet', 65, 'sweet', ['en:sorbets'], ['sorbet']],
  // Snacks et plats
  ['popcorn', 'Pop-corn', 65, 'snack', ['en:popcorn'], ['pop-corn', 'popcorn']],
  ['pretzels', 'Bretzels', 83, 'snack', ['en:pretzels'], ['bretzel']],
  ['corn-chips', 'Chips de maïs / tortilla chips', 63, 'snack', ['en:corn-chips', 'en:tortilla-chips'], ['tortilla chips', 'nachos']],
  ['crackers', 'Crackers salés', 74, 'snack', ['en:crackers'], ['cracker', 'tuc']],
  ['peanuts', 'Cacahuètes', 14, 'snack', ['en:peanuts'], ['cacahuete']],
  ['cashews', 'Noix de cajou', 25, 'snack', ['en:cashew-nuts'], ['noix de cajou']],
  ['pizza', 'Pizza (pâte classique, fromage)', 60, 'snack', ['en:pizzas'], ['pizza']],
  ['quiche', 'Quiche / tarte salée', 50, 'snack', ['en:quiches'], ['quiche']],
  ['chicken-nuggets', 'Nuggets de poulet', 46, 'snack', ['en:chicken-nuggets', 'en:nuggets'], ['nuggets']],
  ['fish-fingers', 'Poisson pané', 38, 'snack', ['en:breaded-fish', 'en:fish-fingers'], ['poisson pane']],
];

export const GI_TABLE: GiFood[] = ROWS.map(([id, name, gi, group, off = [], keys = []]) => ({ id, name, gi, group, off, keys }));

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const BY_OFF = new Map<string, GiFood>();
for (const f of GI_TABLE) for (const t of f.off) if (!BY_OFF.has(t)) BY_OFF.set(t, f);

/**
 * Cherche un aliment de la table à partir des catégories OFF d'un produit.
 * Les tags OFF vont du plus général au plus précis : on part de la fin.
 * Renvoie undefined si rien ne correspond (on n'invente pas d'IG).
 */
export function matchGiByCategories(categories: string[]): GiFood | undefined {
  for (let i = categories.length - 1; i >= 0; i--) {
    const hit = BY_OFF.get(categories[i]!);
    if (hit) return hit;
  }
  return undefined;
}

/** Cherche un aliment de la table par son nom (mot-clé le plus long contenu dans le nom). */
export function matchGiByName(name: string): GiFood | undefined {
  const n = ` ${normalize(name)} `;
  let best: GiFood | undefined;
  let bestLen = 0;
  for (const f of GI_TABLE) {
    for (const k of [normalize(f.name), ...f.keys]) {
      if (k.length > bestLen && (n.includes(` ${k} `) || n.includes(` ${k}s `))) {
        best = f;
        bestLen = k.length;
      }
    }
  }
  return best;
}

/** Alternative de la même famille avec un IG nettement plus bas (au moins 10 points). */
export function lowerGiAlternative(food: GiFood): GiFood | undefined {
  return GI_TABLE.filter((f) => f.group === food.group && f.gi <= food.gi - 10 && f.id !== food.id).sort((a, b) => a.gi - b.gi)[0];
}

export function giLabel(c: GiCategory): string {
  return c === 'low' ? 'IG bas' : c === 'medium' ? 'IG moyen' : 'IG haut';
}
