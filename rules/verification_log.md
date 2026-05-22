# Verification log — ALIM clinical rules

Tracking effort: open each source document, confirm threshold + direction, capture verbatim citation + page number, update `clinical_rules.json` accordingly.

Statuses:
- ✅ **verified** : source PDF ouvert, citation verbatim trouvée à la page indiquée
- 🟡 **adjusted** : seuil seed différait de la source, adapté à la valeur autoritaire
- ❌ **not_found** : pas pu confirmer dans le délai, reste `to_verify`
- 🛈 **derived** : valeur dérivée d'une autre règle vérifiée, pas une citation directe

Last update: 2026-05-16 — Alan

---

## ✅ grossesse_no_raw_cheese / grossesse_no_raw_fish / grossesse_no_charcuterie_cuite_courte — Ameli grossesse alimentation 2025 (verified)

- **Source web** : Assurance Maladie (ameli.fr) — Adapter son alimentation pendant la grossesse. Mise à jour 04/03/2025.
- **URL canonique** : https://www.ameli.fr/assure/sante/devenir-parent/grossesse/grossesse-en-bonne-sante/grossesse-alimentation/alimentation-grossesse
- **Section citée** : "Conseils pour prévenir la listériose au cours de la grossesse"
- **Confirme** :
  - éviter les fromages au lait cru, surtout pâtes molles, croûtes, fromages crus râpés ;
  - éviter poissons fumés, poissons crus, coquillages crus, surimi, tarama ;
  - éviter charcuterie cuite à risque : rillettes, pâtés, foie gras, produits en gelée.
- **Action 2026-05-22 Nora** :
  - `grossesse_no_raw_cheese` → `source_status: "verified"`
  - `grossesse_no_raw_fish` → `source_status: "verified"`
  - `grossesse_no_charcuterie_cuite_courte` → `source_status: "verified"`
- **Note** : `grossesse_no_raw_eggs` reste `derived` : règle maintenue par prudence hygiène alimentaire grossesse, mais la page Ameli consultée ne donne pas un libellé œufs crus aussi explicite que les items listériose ci-dessus.

---

## ✅/🛈 diabete_gestationnel — SFD Paramédical nutrition DG 2021/2022

- **Source PDF** : SFD Paramédical — Nutrition et diabète gestationnel. Recommandations de bonnes pratiques. Version 2021/2022.
- **URL canonique** : https://www.sfdiabete.org/sites/www.sfdiabete.org/files/files/ressources/reco_nutrition_diabete_gestationnel_2022_v2.pdf
- **Pages utilisées** :
  - p.6 : besoins glucidiques, répartition et fractionnement
  - p.8 : index glycémique, charge glycémique, produits sucrés, fibres
- **Confirmations utiles** :
  - le DG demande un contrôle quantitatif et qualitatif des glucides ;
  - les apports glucidiques doivent être répartis en minimum 3 prises journalières ;
  - privilégier les aliments à IG faible ou modéré en tenant compte des préférences alimentaires ;
  - les aliments à IG élevé ne doivent pas être pris isolément et sont à associer à des aliments riches en fibres ;
  - les produits sucrés ne sont pas interdits en quantité limitée, mais s'intègrent à la ration glucidique journalière.
- **Actions 2026-05-22 Nora** :
  - `dg_low_gi_required` → `source_status: "verified"`
  - `dg_carb_per_meal_max` → `source_status: "derived"` : ALIM v0 garde 45 g/repas comme plafond de démonstration prudent, non présenté comme seuil SFD universel.
  - `dg_added_sugar_per_meal_max` → `source_status: "derived"` : ALIM v0 génère zéro sucre ajouté pour la démo, mais ne présente plus cela comme une interdiction clinique générale.
  - `dg_fiber_per_meal_min` → `source_status: "derived"` : 7 g/repas reste un seuil ALIM dérivé, justifié par l'association fibres + impact glycémique.

---

## 🛈 diabete_t2 / hta — sucres, fibres, acides gras saturés (repères journaliers → seuils ALIM dérivés)

- **Sources web utilisées 2026-05-22 Nora** :
  - WHO — Guideline: Sugars intake for adults and children, 2015 : https://www.ncbi.nlm.nih.gov/books/NBK285525/
  - ANSES — Sucres dans l'alimentation : https://www.anses.fr/fr/content/sucres-dans-lalimentation
  - Ameli — Alimentation de l'adulte : manger en forme : https://www.ameli.fr/assure/sante/themes/alimentation-adulte/alimentation-adulte-manger-forme
  - ANSES — Les lipides : https://www.anses.fr/fr/content/les-lipides
- **Actions** :
  - `t2_added_sugar_per_meal_max` : reste `derived`. Le plafond 10 g/repas est un choix ALIM v0 dérivé de la recommandation OMS de réduction des sucres libres ; ne pas présenter comme un seuil HAS/SFD direct.
  - `t2_total_sugar_per_meal_warning` : reste `derived`. Le warning 25 g/repas est dérivé du repère ANSES 100 g/jour de sucres totaux hors lactose/galactose.
  - `t2_fiber_per_meal_min` : reste `derived`. Le seuil 7 g/repas est dérivé des repères adultes 25-30 g/jour.
  - `hta_saturated_fat_per_meal_max` : reste `derived`. Le seuil 7 g/repas est dérivé de repères journaliers ANSES sur les AGS.
- **Pourquoi pas `verified` ?** Les sources vérifient les repères journaliers et directions nutritionnelles, mais les seuils ALIM par repas sont des adaptations de démonstration. Ils ne doivent pas être cités comme seuils officiels directs.

---

## ✅/🛈 clôture sources v0 publique — T2 / HTA / grossesse-DG (2026-05-22 Nora)

Objectif : fermer le périmètre public ALIM v0 sans surpromettre. Les règles activées par les démos publiques T2+HTA et grossesse+diabète gestationnel disposent désormais soit d'une source vérifiée directe, soit d'un statut `derived` documenté quand ALIM applique un seuil de prudence par repas dérivé d'un repère journalier.

- **`t2_low_gi_preferred` → `verified`**
  - Source : Ameli — Diabète : l'alimentation au quotidien.
  - URL : https://www.ameli.fr/assure/sante/themes/diabete-adulte/diabete-vivre-quotidien/equilibre-alimentaire/diabete-alimentation-fondamentaux
  - Confirme : privilégier des aliments à index glycémique bas ou modéré pour limiter l'élévation glycémique postprandiale.
  - Note : règle qualitative, pas un seuil numérique.

- **`hta_potassium_per_meal_min` → `derived`**
  - Source : EFSA — Dietary Reference Values for potassium, EFSA Journal 2016;14(10):4592.
  - URL : https://www.efsa.europa.eu/en/efsajournal/pub/4592
  - Confirme : repère adulte journalier à 3 500 mg/jour.
  - Décision ALIM : seuil 700 mg/repas maintenu comme dérivé prudent, non présenté comme seuil officiel par repas. Règle non activée comme promesse publique stricte si fonction rénale non documentée.

- **`hta_no_alcohol` → `derived`**
  - Source : Ameli — Alimentation et hypertension artérielle.
  - URL : https://www.ameli.fr/assure/sante/themes/hypertension-arterielle-hta/alimentation-et-hta
  - Confirme : alcool à limiter fortement dans l'HTA.
  - Décision ALIM : zéro alcool dans les recettes générées est un choix de sécurité v0, pas une interdiction clinique générale équivalente à la grossesse.

- **`grossesse_no_raw_eggs` → `derived`**
  - Source : ANSES — Qu'est-ce que la salmonellose et comment s'en prémunir ?
  - URL : https://www.anses.fr/fr/content/quest-ce-que-la-salmonellose-et-comment-sen-premunir
  - Confirme : les oeufs et préparations à base d'oeufs crus figurent parmi les véhicules fréquents de salmonelles.
  - Décision ALIM : règle maintenue pour hygiène grossesse avec statut `derived`, car la source confirme le risque alimentaire mais ne constitue pas une recommandation grossesse dédiée aussi directe que les sources Ameli/listériose ou ANSES/toxoplasmose.

**Hors périmètre v0 publique** : les règles `dyslip_saturated_fat_per_meal_max` et `dyslip_cholesterol_per_day_max` restent `to_verify`. Elles ne doivent pas être affichées comme sources finalisées ni utilisées comme axe de démo publique avant revue dédiée dyslipidémie.

---

## ✅ grossesse_caffeine_per_day_max — EFSA 2015 (verified)

- **Source PDF** : EFSA — Caffeine: EFSA explains risk assessment. 2015. TM-04-15-330-EN-N. ISBN 978-92-9199-677-3. doi:10.2805/618813.
- **PDF local** : `/root/.openclaw/alim/corpus/efsa_caffeine_2015.pdf`
- **URL canonique** : https://www.efsa.europa.eu/sites/default/files/corporate_publications/files/efsaexplainscaffeine150527.pdf
- **Avis scientifique sous-jacent** : EFSA Scientific Opinion on the safety of caffeine, EFSA Journal 2015;13(5):4102. doi:10.2903/j.efsa.2015.4102.
- **Page citée** : 3 (rubrique "Pregnant/lactating women")
- **Verbatim** : *"Caffeine intakes from all sources up to 200mg per day consumed throughout the day do not raise safety concerns for the foetus."*
- **Confirme** : seuil 200 mg/jour, "from all sources", pendant la grossesse et la lactation. Aligné avec mon seed.
- **Note** : pour adultes non-enceintes, le seuil EFSA est 400 mg/jour. La distinction grossesse vs population générale doit être respectée côté tool — pas un seuil unique.
- **Action** : `source_url` → URL EFSA, `source_status: "verified"`, `verified_at: "2026-05-16"`, `pdf_page: 3`.

---

## ✅ grossesse_no_raw_meat — ANSES Q/R Toxoplasmose 2007 (verified)

- **Source PDF** : AFSSA (ex-ANSES) — Questions-Réponses Toxoplasmose : état des connaissances et évaluation du risque lié à l'alimentation. Janvier 2007 (date document : 21/09/2006).
- **PDF local** : `/root/.openclaw/alim/corpus/anses_qr_toxoplasmose.pdf`
- **URL canonique** : https://www.anses.fr/fr/system/files/MIC-QR-Toxoplasmose.pdf
- **Page citée** : 2 (Section "4/ Je suis enceinte. Que dois-je faire pour éviter la toxoplasmose ?" — tableau "Synthèse actualisée des recommandations de prévention")
- **Verbatim** : *"Bien cuire tout type de viande (y compris la volaille et le gibier). En pratique, une viande bien cuite a un aspect extérieur doré, voire marron, avec un centre rose très clair, presque beige et ne laisse échapper aucun jus rosé."* / *"Une viande bien cuite correspond à une température à cœur comprise entre 68 et 72°C."* / *"Eviter la cuisson des viandes au four à micro-ondes."*
- **Confirme** : viande crue / saignante / peu cuite proscrite chez la femme enceinte (sauf immunité toxoplasmose confirmée). Précision température 68-72°C à cœur (mon seed disait > 70°C, je m'aligne sur la fourchette précise).
- **Action** : `source_url` → URL ANSES, `source_status: "verified"`, `verified_at: "2026-05-16"`, `pdf_page: 2`. Ajouter la fourchette "68-72°C à cœur" dans `rationale_fr`.

---

## ✅ grossesse_wash_raw_vegetables — ANSES Q/R Toxoplasmose 2007 (verified)

- **Source PDF** : idem `grossesse_no_raw_meat`.
- **Page citée** : 2 (même tableau).
- **Verbatim** : *"Lors de la préparation des repas, laver à grande eau les légumes et les plantes aromatiques, surtout s'ils sont terreux et consommés crus. Précautions particulièrement renforcées pour les végétaux constamment souillés par de la terre et consommés crus ; radis, salade, fraises, champignons."*
- **Confirme** : warning lavage soigneux obligatoire dans `warnings` pour toute recette grossesse contenant des légumes crus.
- **Action** : `source_url` → URL ANSES, `source_status: "verified"`, `verified_at: "2026-05-16"`, `pdf_page: 2`.

---

## 🛈 Note méthodologique — toxoplasmose vs listériose

L'ANSES Q/R Toxoplasmose précise explicitement : *"la consommation de poisson, de lait de vache et de fromages ne présente pas de risque vis à vis de la toxoplasmose"*. Donc les règles `grossesse_no_raw_cheese`, `grossesse_no_raw_fish`, `grossesse_no_raw_eggs`, `grossesse_no_charcuterie_cuite_courte` ne sont pas couvertes par cette source — elles relèvent de la **listériose**, qui demande un autre PDF ANSES (à récupérer dans la prochaine session de vérification, candidat : ANSES portail listériose ou avis MIC-Ra-ListerioseAliments).

---

## 🟡 t2_carb_per_meal_max / t2_carb_per_meal_min — HAS T2 2024 (derived, pas verified)

- **Source PDF** : HAS – Stratégie thérapeutique du patient vivant avec un diabète de type 2 (recommandations). Mai 2024. 56 pages.
- **PDF local** : `/root/.openclaw/alim/corpus/has_t2_2024.pdf`
- **URL canonique** : https://www.has-sante.fr/upload/docs/application/pdf/2024-06/strategie_therapeutique_du_patient_vivant_avec_un_diabete_de_type_2_-_recommandations.pdf
- **Constat** : La HAS T2 2024, mis à jour exhaustivement par rapport à 2013, **ne fixe PAS de seuil glucidique chiffré par repas**. Les recommandations nutritionnelles (R.30 à R.38) restent qualitatives : alimentation équilibrée, individualisation (R.32, R.36), perte de poids ≥ 5 % si surpoids (R.34), pas de régimes restrictifs chez personnes âgées/dénutrition (R.37), pas de régime très faible en glucides ou cétogène (R.91 plus loin dans le PDF).
- **Verbatim R.30** : *"Il est recommandé la mise en place d'un programme complet et global de modification du mode de vie, dès le diagnostic, comprenant une alimentation équilibrée et l'atteinte des objectifs d'activité physique adaptée dans le but d'améliorer l'équilibre glycémique (grade C)."*
- **Décision** : mes seuils numériques (60 g max / 30 g min par repas) sont **non-citables comme HAS directs**. Je les passe en `source_status: "derived"` avec citation du principe HAS comme garde-fou. Le service Node ne doit pas afficher ces chiffres comme "HAS recommande 60 g".
- **Pour aller plus loin** : la SFD (Société Francophone du Diabète) ou Diabetes UK (cité par HAS en référence) ont des seuils plus précis. À explorer si V0+ nécessite des seuils chiffrés présentables comme officiels.

---

## ✅ grossesse_no_alcohol — HAS 2009 (verified)

- **Source PDF** : HAS – Projet de grossesse : informations, messages de prévention, examens à proposer (argumentaire). Septembre 2009. Service des bonnes pratiques professionnelles.
- **PDF local** : `/root/.openclaw/alim/corpus/has_projet_grossesse_argumentaire.pdf`
- **URL canonique** : https://www.has-sante.fr/upload/docs/application/pdf/2010-01/projet_de_grossesse_informations_messages_de_prevention_examens_a_proposer_-_argumentaire.pdf
- **Page citée** : 19 (section 4.6.2 Alcool, tabac, usage de drogues)
- **Verbatim** : *"l'alcool a une toxicité démontrée sur la période embryonnaire et la période fœtale (grade A). Il doit être recommandé aux femmes de ne pas consommer de boissons contenant de l'alcool pendant toute la durée de la grossesse."* / *"Il n'est pas possible de définir une dose minimale d'alcoolisation sans conséquences sur le fœtus (grade B)."*
- **Confirme** : tolérance zéro alcool grossesse, grade A HAS. Aligné avec mon seed.
- **Action** : `source_url` → URL HAS PDF, `source_status: "verified"`, `verified_at: "2026-05-16"`, `pdf_page: 19`.

---

## ✅ grossesse_b9_per_day_min — HAS 2009 (verified, avec caveat)

- **Source PDF** : idem `grossesse_no_alcohol`.
- **Page citée** : 15 (section 4.4 Traitements médicamenteux).
- **Verbatim** : *"Les quatre recommandations internationales analysées préconisent une supplémentation en acide folique en période préconceptionnelle à raison de 400 microgrammes par jour jusqu'à la 12e semaine d'aménorrhée (la posologie est plus importante en cas de profil à risque : antécédent de spina bifida, diabète et traitement épileptique)."*
- **Caveat important** : la référence HAS porte sur la **supplémentation pharmaceutique** (médicament), pas sur l'apport alimentaire en folates. Pour ALIM, on garde 400 µg/jour comme cible orientative pour l'apport alimentaire, mais la `rationale_fr` doit explicitement noter que la supplémentation médicamenteuse reste prescrite séparément par le médecin et n'est pas remplacée par le contenu de la recette.
- **Action** : `source_url` → URL HAS, `source_status: "verified"`, `verified_at: "2026-05-16"`, `pdf_page: 15`. `rationale_fr` enrichi du caveat.

---

## ✅ hta_salt_per_day_max — WHO 2012 (verified)

- **Source PDF** : WHO Guideline: Sodium intake for adults and children, 2012 (reprinted 2014). ISBN 978 92 4 150483 6.
- **PDF local** : `/root/.openclaw/alim/corpus/who_sodium_2012.pdf`
- **URL canonique** : https://iris.who.int/server/api/core/bitstreams/d0f9feb5-ed78-44d1-9e06-533a93352012/content
- **Page citée** : 2 (Executive summary — Recommendations)
- **Verbatim** : *"WHO recommends a reduction to <2 g/day sodium (5 g/day salt) in adults (strong recommendation)."*
- **Grading WHO** : **strong recommendation**.
- **Applicabilité** : *"These recommendations apply to all individuals, with or without hypertension (including pregnant and lactating women), except for individuals with illnesses or taking drug therapy that may lead to hyponatraemia […] or require physician-supervised diets (e.g. patients with heart failure and those with type I diabetes)."* (page 3)
- **Confirme** : seuil 5 g/jour sel = 2 g/jour sodium. Cohérent avec ma valeur seed.
- **Action** : `source_url` → URL canonique WHO IRIS, `source_status: "verified"`, `verified_at: "2026-05-16"`, `pdf_page: 2`.

---
