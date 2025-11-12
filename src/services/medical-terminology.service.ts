/**
 * Medical Terminology Service
 * 
 * Provides standardization and validation for medical terms including:
 * - Medications (brand/generic mapping, RxNorm codes)
 * - Diagnoses (ICD-10, SNOMED CT)
 * - Procedures (CPT codes)
 * - Fuzzy matching with confidence scoring
 * 
 * Week 3, Day 11: Medical Intelligence Foundation
 */

export interface DrugInfo {
  generic: string;
  brandNames: string[];
  rxNormCode?: string;
  drugClass: string;
  typicalDoses?: string[];
  routes: string[];
  neurosurgicalUse: boolean;
}

export interface DiagnosisInfo {
  name: string;
  icd10Code: string;
  snomedCode?: string;
  category: string;
  severity?: 'mild' | 'moderate' | 'severe' | 'critical';
  laterality?: 'left' | 'right' | 'bilateral' | 'midline';
}

export interface ProcedureInfo {
  name: string;
  cptCode?: string;
  icd10PcsCode?: string;
  category: string;
  approach?: string;
  complications?: string[];
}

export interface TermMatch {
  term: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'partial';
  standardizedTerm: string;
  metadata?: DrugInfo | DiagnosisInfo | ProcedureInfo;
}

export class MedicalTerminologyService {
  private drugDictionary: Map<string, DrugInfo> = new Map();
  private diagnosisDictionary: Map<string, DiagnosisInfo> = new Map();
  private procedureDictionary: Map<string, ProcedureInfo> = new Map();

  constructor() {
    this.initializeDrugDictionary();
    this.initializeDiagnosisDictionary();
    this.initializeProcedureDictionary();
  }

  /**
   * Initialize comprehensive neurosurgical drug dictionary
   */
  private initializeDrugDictionary(): void {
    const drugs: DrugInfo[] = [
      // Anticonvulsants / Antiepileptics
      {
        generic: 'levetiracetam',
        brandNames: ['Keppra'],
        rxNormCode: '135446',
        drugClass: 'Anticonvulsant',
        typicalDoses: ['500mg', '750mg', '1000mg', '1500mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'phenytoin',
        brandNames: ['Dilantin'],
        rxNormCode: '8183',
        drugClass: 'Anticonvulsant',
        typicalDoses: ['100mg', '200mg', '300mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'fosphenytoin',
        brandNames: ['Cerebyx'],
        rxNormCode: '25025',
        drugClass: 'Anticonvulsant',
        typicalDoses: ['100mg PE', '150mg PE'],
        routes: ['IV', 'IM'],
        neurosurgicalUse: true,
      },
      {
        generic: 'valproic acid',
        brandNames: ['Depakote', 'Depakene'],
        rxNormCode: '11118',
        drugClass: 'Anticonvulsant',
        typicalDoses: ['250mg', '500mg', '750mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'lacosamide',
        brandNames: ['Vimpat'],
        rxNormCode: '77035',
        drugClass: 'Anticonvulsant',
        typicalDoses: ['50mg', '100mg', '150mg', '200mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'lamotrigine',
        brandNames: ['Lamictal'],
        rxNormCode: '6470',
        drugClass: 'Anticonvulsant',
        typicalDoses: ['25mg', '100mg', '150mg', '200mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'topiramate',
        brandNames: ['Topamax'],
        rxNormCode: '38404',
        drugClass: 'Anticonvulsant',
        typicalDoses: ['25mg', '50mg', '100mg', '200mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'carbamazepine',
        brandNames: ['Tegretol', 'Carbatrol'],
        rxNormCode: '2002',
        drugClass: 'Anticonvulsant',
        typicalDoses: ['200mg', '400mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },

      // Corticosteroids
      {
        generic: 'dexamethasone',
        brandNames: ['Decadron'],
        rxNormCode: '3264',
        drugClass: 'Corticosteroid',
        typicalDoses: ['2mg', '4mg', '6mg', '10mg'],
        routes: ['oral', 'IV', 'IM'],
        neurosurgicalUse: true,
      },
      {
        generic: 'methylprednisolone',
        brandNames: ['Solu-Medrol', 'Medrol'],
        rxNormCode: '6902',
        drugClass: 'Corticosteroid',
        typicalDoses: ['4mg', '8mg', '16mg', '125mg', '500mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'prednisone',
        brandNames: ['Deltasone'],
        rxNormCode: '8640',
        drugClass: 'Corticosteroid',
        typicalDoses: ['5mg', '10mg', '20mg', '50mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },

      // Osmotic Diuretics
      {
        generic: 'mannitol',
        brandNames: ['Osmitrol'],
        rxNormCode: '6754',
        drugClass: 'Osmotic Diuretic',
        typicalDoses: ['12.5g', '25g', '50g', '100g'],
        routes: ['IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'hypertonic saline',
        brandNames: ['3% NaCl', '23.4% NaCl'],
        rxNormCode: '313002',
        drugClass: 'Osmotic Agent',
        typicalDoses: ['30mL', '250mL'],
        routes: ['IV'],
        neurosurgicalUse: true,
      },

      // Analgesics - Opioids
      {
        generic: 'oxycodone',
        brandNames: ['OxyContin', 'Roxicodone'],
        rxNormCode: '7804',
        drugClass: 'Opioid Analgesic',
        typicalDoses: ['5mg', '10mg', '15mg', '20mg', '30mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'hydrocodone',
        brandNames: ['Vicodin', 'Norco', 'Lortab'],
        rxNormCode: '5489',
        drugClass: 'Opioid Analgesic',
        typicalDoses: ['5mg', '7.5mg', '10mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'morphine',
        brandNames: ['MS Contin', 'Roxanol'],
        rxNormCode: '7052',
        drugClass: 'Opioid Analgesic',
        typicalDoses: ['2mg', '4mg', '15mg', '30mg'],
        routes: ['oral', 'IV', 'IM', 'SC'],
        neurosurgicalUse: true,
      },
      {
        generic: 'hydromorphone',
        brandNames: ['Dilaudid'],
        rxNormCode: '3423',
        drugClass: 'Opioid Analgesic',
        typicalDoses: ['2mg', '4mg', '8mg'],
        routes: ['oral', 'IV', 'SC'],
        neurosurgicalUse: true,
      },
      {
        generic: 'fentanyl',
        brandNames: ['Duragesic', 'Sublimaze'],
        rxNormCode: '4337',
        drugClass: 'Opioid Analgesic',
        typicalDoses: ['25mcg', '50mcg', '75mcg', '100mcg'],
        routes: ['IV', 'transdermal', 'buccal'],
        neurosurgicalUse: true,
      },
      {
        generic: 'tramadol',
        brandNames: ['Ultram'],
        rxNormCode: '10689',
        drugClass: 'Opioid-like Analgesic',
        typicalDoses: ['50mg', '100mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },

      // Analgesics - Non-Opioid
      {
        generic: 'acetaminophen',
        brandNames: ['Tylenol'],
        rxNormCode: '161',
        drugClass: 'Non-Opioid Analgesic',
        typicalDoses: ['325mg', '500mg', '650mg', '1000mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'ibuprofen',
        brandNames: ['Motrin', 'Advil'],
        rxNormCode: '5640',
        drugClass: 'NSAID',
        typicalDoses: ['200mg', '400mg', '600mg', '800mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'ketorolac',
        brandNames: ['Toradol'],
        rxNormCode: '6142',
        drugClass: 'NSAID',
        typicalDoses: ['10mg', '15mg', '30mg'],
        routes: ['oral', 'IV', 'IM'],
        neurosurgicalUse: true,
      },
      {
        generic: 'gabapentin',
        brandNames: ['Neurontin'],
        rxNormCode: '25480',
        drugClass: 'Anticonvulsant/Analgesic',
        typicalDoses: ['100mg', '300mg', '600mg', '800mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'pregabalin',
        brandNames: ['Lyrica'],
        rxNormCode: '187832',
        drugClass: 'Anticonvulsant/Analgesic',
        typicalDoses: ['75mg', '150mg', '225mg', '300mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },

      // Anticoagulants / Antiplatelets
      {
        generic: 'aspirin',
        brandNames: ['Bayer', 'Ecotrin'],
        rxNormCode: '1191',
        drugClass: 'Antiplatelet',
        typicalDoses: ['81mg', '325mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'clopidogrel',
        brandNames: ['Plavix'],
        rxNormCode: '32968',
        drugClass: 'Antiplatelet',
        typicalDoses: ['75mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'warfarin',
        brandNames: ['Coumadin'],
        rxNormCode: '11289',
        drugClass: 'Anticoagulant',
        typicalDoses: ['1mg', '2mg', '2.5mg', '5mg', '7.5mg', '10mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'enoxaparin',
        brandNames: ['Lovenox'],
        rxNormCode: '67108',
        drugClass: 'Anticoagulant (LMWH)',
        typicalDoses: ['30mg', '40mg', '60mg'],
        routes: ['SC'],
        neurosurgicalUse: true,
      },
      {
        generic: 'heparin',
        brandNames: ['Heparin'],
        rxNormCode: '5224',
        drugClass: 'Anticoagulant',
        typicalDoses: ['5000 units', '7500 units'],
        routes: ['IV', 'SC'],
        neurosurgicalUse: true,
      },
      {
        generic: 'apixaban',
        brandNames: ['Eliquis'],
        rxNormCode: '1364430',
        drugClass: 'Anticoagulant (DOAC)',
        typicalDoses: ['2.5mg', '5mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'rivaroxaban',
        brandNames: ['Xarelto'],
        rxNormCode: '1114195',
        drugClass: 'Anticoagulant (DOAC)',
        typicalDoses: ['10mg', '15mg', '20mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },

      // Antibiotics
      {
        generic: 'cefazolin',
        brandNames: ['Ancef', 'Kefzol'],
        rxNormCode: '2270',
        drugClass: 'Antibiotic (Cephalosporin)',
        typicalDoses: ['1g', '2g'],
        routes: ['IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'ceftriaxone',
        brandNames: ['Rocephin'],
        rxNormCode: '2193',
        drugClass: 'Antibiotic (Cephalosporin)',
        typicalDoses: ['1g', '2g'],
        routes: ['IV', 'IM'],
        neurosurgicalUse: true,
      },
      {
        generic: 'vancomycin',
        brandNames: ['Vancocin'],
        rxNormCode: '11124',
        drugClass: 'Antibiotic (Glycopeptide)',
        typicalDoses: ['125mg', '250mg', '500mg', '1g', '1.5g'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'metronidazole',
        brandNames: ['Flagyl'],
        rxNormCode: '6922',
        drugClass: 'Antibiotic (Nitroimidazole)',
        typicalDoses: ['250mg', '500mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'meropenem',
        brandNames: ['Merrem'],
        rxNormCode: '6851',
        drugClass: 'Antibiotic (Carbapenem)',
        typicalDoses: ['500mg', '1g', '2g'],
        routes: ['IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'ciprofloxacin',
        brandNames: ['Cipro'],
        rxNormCode: '2551',
        drugClass: 'Antibiotic (Fluoroquinolone)',
        typicalDoses: ['250mg', '500mg', '750mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'levofloxacin',
        brandNames: ['Levaquin'],
        rxNormCode: '82122',
        drugClass: 'Antibiotic (Fluoroquinolone)',
        typicalDoses: ['250mg', '500mg', '750mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },

      // GI Medications
      {
        generic: 'pantoprazole',
        brandNames: ['Protonix'],
        rxNormCode: '40790',
        drugClass: 'Proton Pump Inhibitor',
        typicalDoses: ['20mg', '40mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'omeprazole',
        brandNames: ['Prilosec'],
        rxNormCode: '7646',
        drugClass: 'Proton Pump Inhibitor',
        typicalDoses: ['20mg', '40mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'famotidine',
        brandNames: ['Pepcid'],
        rxNormCode: '4278',
        drugClass: 'H2 Blocker',
        typicalDoses: ['20mg', '40mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'ondansetron',
        brandNames: ['Zofran'],
        rxNormCode: '7561',
        drugClass: 'Antiemetic',
        typicalDoses: ['4mg', '8mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'metoclopramide',
        brandNames: ['Reglan'],
        rxNormCode: '6915',
        drugClass: 'Antiemetic/Prokinetic',
        typicalDoses: ['5mg', '10mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'docusate',
        brandNames: ['Colace'],
        rxNormCode: '3399',
        drugClass: 'Stool Softener',
        typicalDoses: ['100mg', '250mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'senna',
        brandNames: ['Senokot'],
        rxNormCode: '9766',
        drugClass: 'Laxative',
        typicalDoses: ['8.6mg', '17.2mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'polyethylene glycol',
        brandNames: ['MiraLAX'],
        rxNormCode: '202462',
        drugClass: 'Laxative',
        typicalDoses: ['17g'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },

      // Antihypertensives
      {
        generic: 'labetalol',
        brandNames: ['Trandate'],
        rxNormCode: '6185',
        drugClass: 'Beta Blocker',
        typicalDoses: ['100mg', '200mg', '300mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'metoprolol',
        brandNames: ['Lopressor', 'Toprol-XL'],
        rxNormCode: '6918',
        drugClass: 'Beta Blocker',
        typicalDoses: ['25mg', '50mg', '100mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'nicardipine',
        brandNames: ['Cardene'],
        rxNormCode: '7417',
        drugClass: 'Calcium Channel Blocker',
        typicalDoses: ['2.5mg/hr', '5mg/hr', '15mg/hr'],
        routes: ['IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'nimodipine',
        brandNames: ['Nimotop'],
        rxNormCode: '7454',
        drugClass: 'Calcium Channel Blocker',
        typicalDoses: ['60mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'hydralazine',
        brandNames: ['Apresoline'],
        rxNormCode: '5470',
        drugClass: 'Vasodilator',
        typicalDoses: ['10mg', '25mg', '50mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'enalapril',
        brandNames: ['Vasotec'],
        rxNormCode: '3827',
        drugClass: 'ACE Inhibitor',
        typicalDoses: ['2.5mg', '5mg', '10mg', '20mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'lisinopril',
        brandNames: ['Prinivil', 'Zestril'],
        rxNormCode: '29046',
        drugClass: 'ACE Inhibitor',
        typicalDoses: ['5mg', '10mg', '20mg', '40mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'losartan',
        brandNames: ['Cozaar'],
        rxNormCode: '52175',
        drugClass: 'ARB',
        typicalDoses: ['25mg', '50mg', '100mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'amlodipine',
        brandNames: ['Norvasc'],
        rxNormCode: '17767',
        drugClass: 'Calcium Channel Blocker',
        typicalDoses: ['2.5mg', '5mg', '10mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },

      // Diuretics
      {
        generic: 'furosemide',
        brandNames: ['Lasix'],
        rxNormCode: '4603',
        drugClass: 'Loop Diuretic',
        typicalDoses: ['20mg', '40mg', '80mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'hydrochlorothiazide',
        brandNames: ['HCTZ', 'Microzide'],
        rxNormCode: '5487',
        drugClass: 'Thiazide Diuretic',
        typicalDoses: ['12.5mg', '25mg', '50mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'spironolactone',
        brandNames: ['Aldactone'],
        rxNormCode: '9997',
        drugClass: 'Potassium-Sparing Diuretic',
        typicalDoses: ['25mg', '50mg', '100mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },

      // Diabetes Medications
      {
        generic: 'insulin',
        brandNames: ['Humulin', 'Novolin', 'Humalog', 'NovoLog'],
        rxNormCode: '5856',
        drugClass: 'Insulin',
        typicalDoses: ['varies per sliding scale'],
        routes: ['SC', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'metformin',
        brandNames: ['Glucophage'],
        rxNormCode: '6809',
        drugClass: 'Biguanide',
        typicalDoses: ['500mg', '850mg', '1000mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },

      // Antihistamines
      {
        generic: 'diphenhydramine',
        brandNames: ['Benadryl'],
        rxNormCode: '3498',
        drugClass: 'Antihistamine',
        typicalDoses: ['25mg', '50mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'cetirizine',
        brandNames: ['Zyrtec'],
        rxNormCode: '20610',
        drugClass: 'Antihistamine',
        typicalDoses: ['5mg', '10mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },

      // Sedatives / Anxiolytics
      {
        generic: 'lorazepam',
        brandNames: ['Ativan'],
        rxNormCode: '6470',
        drugClass: 'Benzodiazepine',
        typicalDoses: ['0.5mg', '1mg', '2mg'],
        routes: ['oral', 'IV', 'IM'],
        neurosurgicalUse: true,
      },
      {
        generic: 'midazolam',
        brandNames: ['Versed'],
        rxNormCode: '6960',
        drugClass: 'Benzodiazepine',
        typicalDoses: ['1mg', '2mg', '5mg'],
        routes: ['IV', 'IM', 'intranasal'],
        neurosurgicalUse: true,
      },
      {
        generic: 'diazepam',
        brandNames: ['Valium'],
        rxNormCode: '3322',
        drugClass: 'Benzodiazepine',
        typicalDoses: ['2mg', '5mg', '10mg'],
        routes: ['oral', 'IV', 'rectal'],
        neurosurgicalUse: true,
      },
      {
        generic: 'propofol',
        brandNames: ['Diprivan'],
        rxNormCode: '8782',
        drugClass: 'Sedative-Hypnotic',
        typicalDoses: ['varies per infusion'],
        routes: ['IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'dexmedetomidine',
        brandNames: ['Precedex'],
        rxNormCode: '77492',
        drugClass: 'Alpha-2 Agonist',
        typicalDoses: ['varies per infusion'],
        routes: ['IV'],
        neurosurgicalUse: true,
      },

      // Muscle Relaxants
      {
        generic: 'baclofen',
        brandNames: ['Lioresal'],
        rxNormCode: '1292',
        drugClass: 'Muscle Relaxant',
        typicalDoses: ['5mg', '10mg', '20mg'],
        routes: ['oral', 'intrathecal'],
        neurosurgicalUse: true,
      },
      {
        generic: 'tizanidine',
        brandNames: ['Zanaflex'],
        rxNormCode: '38218',
        drugClass: 'Muscle Relaxant',
        typicalDoses: ['2mg', '4mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'cyclobenzaprine',
        brandNames: ['Flexeril'],
        rxNormCode: '3112',
        drugClass: 'Muscle Relaxant',
        typicalDoses: ['5mg', '10mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },

      // Antidepressants
      {
        generic: 'sertraline',
        brandNames: ['Zoloft'],
        rxNormCode: '36437',
        drugClass: 'SSRI',
        typicalDoses: ['25mg', '50mg', '100mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'citalopram',
        brandNames: ['Celexa'],
        rxNormCode: '2556',
        drugClass: 'SSRI',
        typicalDoses: ['10mg', '20mg', '40mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'escitalopram',
        brandNames: ['Lexapro'],
        rxNormCode: '321988',
        drugClass: 'SSRI',
        typicalDoses: ['5mg', '10mg', '20mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'duloxetine',
        brandNames: ['Cymbalta'],
        rxNormCode: '72625',
        drugClass: 'SNRI',
        typicalDoses: ['30mg', '60mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'venlafaxine',
        brandNames: ['Effexor'],
        rxNormCode: '39786',
        drugClass: 'SNRI',
        typicalDoses: ['37.5mg', '75mg', '150mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },

      // Antipsychotics
      {
        generic: 'haloperidol',
        brandNames: ['Haldol'],
        rxNormCode: '5093',
        drugClass: 'Antipsychotic',
        typicalDoses: ['0.5mg', '1mg', '2mg', '5mg'],
        routes: ['oral', 'IV', 'IM'],
        neurosurgicalUse: true,
      },
      {
        generic: 'quetiapine',
        brandNames: ['Seroquel'],
        rxNormCode: '60819',
        drugClass: 'Antipsychotic',
        typicalDoses: ['25mg', '50mg', '100mg', '200mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'olanzapine',
        brandNames: ['Zyprexa'],
        rxNormCode: '61381',
        drugClass: 'Antipsychotic',
        typicalDoses: ['2.5mg', '5mg', '10mg', '15mg'],
        routes: ['oral', 'IM'],
        neurosurgicalUse: true,
      },

      // Stimulants
      {
        generic: 'modafinil',
        brandNames: ['Provigil'],
        rxNormCode: '73218',
        drugClass: 'Stimulant',
        typicalDoses: ['100mg', '200mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },
      {
        generic: 'methylphenidate',
        brandNames: ['Ritalin', 'Concerta'],
        rxNormCode: '6901',
        drugClass: 'Stimulant',
        typicalDoses: ['5mg', '10mg', '18mg', '27mg', '36mg'],
        routes: ['oral'],
        neurosurgicalUse: true,
      },

      // Electrolytes
      {
        generic: 'potassium chloride',
        brandNames: ['K-Dur', 'Klor-Con'],
        rxNormCode: '8591',
        drugClass: 'Electrolyte',
        typicalDoses: ['10mEq', '20mEq', '40mEq'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'magnesium sulfate',
        brandNames: ['Magnesium'],
        rxNormCode: '6735',
        drugClass: 'Electrolyte',
        typicalDoses: ['1g', '2g', '4g'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'calcium gluconate',
        brandNames: ['Calcium'],
        rxNormCode: '1998',
        drugClass: 'Electrolyte',
        typicalDoses: ['1g', '2g'],
        routes: ['IV'],
        neurosurgicalUse: true,
      },

      // Vitamins
      {
        generic: 'thiamine',
        brandNames: ['Vitamin B1'],
        rxNormCode: '10136',
        drugClass: 'Vitamin',
        typicalDoses: ['100mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'folic acid',
        brandNames: ['Folate'],
        rxNormCode: '4637',
        drugClass: 'Vitamin',
        typicalDoses: ['1mg'],
        routes: ['oral', 'IV'],
        neurosurgicalUse: true,
      },
      {
        generic: 'cyanocobalamin',
        brandNames: ['Vitamin B12'],
        rxNormCode: '3106',
        drugClass: 'Vitamin',
        typicalDoses: ['1000mcg'],
        routes: ['oral', 'IM'],
        neurosurgicalUse: true,
      },
    ];

    // Index by generic name (lowercase)
    drugs.forEach((drug) => {
      this.drugDictionary.set(drug.generic.toLowerCase(), drug);
      
      // Also index by brand names
      drug.brandNames.forEach((brandName) => {
        this.drugDictionary.set(brandName.toLowerCase(), drug);
      });
    });
  }

  /**
   * Initialize diagnosis dictionary (to be expanded in Day 12)
   */
  private initializeDiagnosisDictionary(): void {
    const diagnoses: DiagnosisInfo[] = [
      // Primary Brain Tumors - Gliomas
      {
        name: 'glioblastoma',
        icd10Code: 'C71.9',
        snomedCode: '393563007',
        category: 'Malignant Brain Tumor',
        severity: 'critical',
      },
      {
        name: 'glioblastoma multiforme',
        icd10Code: 'C71.9',
        snomedCode: '393563007',
        category: 'Malignant Brain Tumor',
        severity: 'critical',
      },
      {
        name: 'anaplastic astrocytoma',
        icd10Code: 'C71.9',
        snomedCode: '444093005',
        category: 'Malignant Brain Tumor',
        severity: 'severe',
      },
      {
        name: 'diffuse astrocytoma',
        icd10Code: 'C71.9',
        snomedCode: '89458003',
        category: 'Brain Tumor',
        severity: 'moderate',
      },
      {
        name: 'oligodendroglioma',
        icd10Code: 'C71.9',
        snomedCode: '23173009',
        category: 'Brain Tumor',
        severity: 'moderate',
      },
      {
        name: 'ependymoma',
        icd10Code: 'C71.9',
        snomedCode: '31255001',
        category: 'Brain Tumor',
        severity: 'moderate',
      },

      // Primary Brain Tumors - Meningiomas
      {
        name: 'meningioma',
        icd10Code: 'D32.9',
        snomedCode: '302809003',
        category: 'Benign Brain Tumor',
        severity: 'mild',
      },
      {
        name: 'atypical meningioma',
        icd10Code: 'D32.9',
        snomedCode: '404030007',
        category: 'Brain Tumor',
        severity: 'moderate',
      },
      {
        name: 'anaplastic meningioma',
        icd10Code: 'C70.9',
        snomedCode: '134298003',
        category: 'Malignant Brain Tumor',
        severity: 'severe',
      },

      // Other Primary Brain Tumors
      {
        name: 'pituitary adenoma',
        icd10Code: 'D35.2',
        snomedCode: '254938000',
        category: 'Benign Brain Tumor',
        severity: 'mild',
      },
      {
        name: 'craniopharyngioma',
        icd10Code: 'D44.4',
        snomedCode: '93026004',
        category: 'Brain Tumor',
        severity: 'moderate',
      },
      {
        name: 'acoustic neuroma',
        icd10Code: 'D33.3',
        snomedCode: '68652001',
        category: 'Benign Brain Tumor',
        severity: 'mild',
      },
      {
        name: 'vestibular schwannoma',
        icd10Code: 'D33.3',
        snomedCode: '68652001',
        category: 'Benign Brain Tumor',
        severity: 'mild',
      },
      {
        name: 'medulloblastoma',
        icd10Code: 'C71.6',
        snomedCode: '443333004',
        category: 'Malignant Brain Tumor',
        severity: 'critical',
      },
      {
        name: 'hemangioblastoma',
        icd10Code: 'D33.1',
        snomedCode: '253056009',
        category: 'Benign Brain Tumor',
        severity: 'mild',
      },

      // Metastatic Brain Tumors
      {
        name: 'brain metastasis',
        icd10Code: 'C79.31',
        snomedCode: '94225005',
        category: 'Metastatic Cancer',
        severity: 'critical',
      },
      {
        name: 'brain metastases',
        icd10Code: 'C79.31',
        snomedCode: '94225005',
        category: 'Metastatic Cancer',
        severity: 'critical',
      },

      // Vascular Conditions
      {
        name: 'subarachnoid hemorrhage',
        icd10Code: 'I60.9',
        snomedCode: '21454007',
        category: 'Hemorrhagic Stroke',
        severity: 'critical',
      },
      {
        name: 'intracerebral hemorrhage',
        icd10Code: 'I61.9',
        snomedCode: '274100004',
        category: 'Hemorrhagic Stroke',
        severity: 'critical',
      },
      {
        name: 'subdural hematoma',
        icd10Code: 'I62.0',
        snomedCode: '95453001',
        category: 'Traumatic Brain Injury',
        severity: 'severe',
      },
      {
        name: 'acute subdural hematoma',
        icd10Code: 'S06.5X0A',
        snomedCode: '432987000',
        category: 'Traumatic Brain Injury',
        severity: 'critical',
      },
      {
        name: 'chronic subdural hematoma',
        icd10Code: 'I62.03',
        snomedCode: '95453001',
        category: 'Traumatic Brain Injury',
        severity: 'moderate',
      },
      {
        name: 'epidural hematoma',
        icd10Code: 'S06.4X0A',
        snomedCode: '21037001',
        category: 'Traumatic Brain Injury',
        severity: 'critical',
      },
      {
        name: 'cerebral aneurysm',
        icd10Code: 'I67.1',
        snomedCode: '128612001',
        category: 'Vascular Malformation',
        severity: 'severe',
      },
      {
        name: 'ruptured aneurysm',
        icd10Code: 'I60.9',
        snomedCode: '425007005',
        category: 'Hemorrhagic Stroke',
        severity: 'critical',
      },
      {
        name: 'arteriovenous malformation',
        icd10Code: 'Q28.2',
        snomedCode: '128604009',
        category: 'Vascular Malformation',
        severity: 'severe',
      },
      {
        name: 'AVM',
        icd10Code: 'Q28.2',
        snomedCode: '128604009',
        category: 'Vascular Malformation',
        severity: 'severe',
      },
      {
        name: 'cavernous malformation',
        icd10Code: 'Q28.3',
        snomedCode: '19564001',
        category: 'Vascular Malformation',
        severity: 'moderate',
      },
      {
        name: 'cavernoma',
        icd10Code: 'Q28.3',
        snomedCode: '19564001',
        category: 'Vascular Malformation',
        severity: 'moderate',
      },

      // Ischemic Stroke
      {
        name: 'ischemic stroke',
        icd10Code: 'I63.9',
        snomedCode: '422504002',
        category: 'Ischemic Stroke',
        severity: 'severe',
      },
      {
        name: 'acute ischemic stroke',
        icd10Code: 'I63.9',
        snomedCode: '422504002',
        category: 'Ischemic Stroke',
        severity: 'critical',
      },

      // Traumatic Brain Injury
      {
        name: 'traumatic brain injury',
        icd10Code: 'S06.9X0A',
        snomedCode: '127295002',
        category: 'Traumatic Brain Injury',
        severity: 'severe',
      },
      {
        name: 'TBI',
        icd10Code: 'S06.9X0A',
        snomedCode: '127295002',
        category: 'Traumatic Brain Injury',
        severity: 'severe',
      },
      {
        name: 'diffuse axonal injury',
        icd10Code: 'S06.2X0A',
        snomedCode: '41819009',
        category: 'Traumatic Brain Injury',
        severity: 'critical',
      },
      {
        name: 'cerebral contusion',
        icd10Code: 'S06.330A',
        snomedCode: '81371001',
        category: 'Traumatic Brain Injury',
        severity: 'moderate',
      },
      {
        name: 'skull fracture',
        icd10Code: 'S02.9',
        snomedCode: '71642004',
        category: 'Traumatic Brain Injury',
        severity: 'moderate',
      },
      {
        name: 'depressed skull fracture',
        icd10Code: 'S02.0',
        snomedCode: '20219005',
        category: 'Traumatic Brain Injury',
        severity: 'severe',
      },

      // Hydrocephalus
      {
        name: 'hydrocephalus',
        icd10Code: 'G91.9',
        snomedCode: '230745008',
        category: 'CSF Disorder',
        severity: 'moderate',
      },
      {
        name: 'normal pressure hydrocephalus',
        icd10Code: 'G91.2',
        snomedCode: '31455001',
        category: 'CSF Disorder',
        severity: 'moderate',
      },
      {
        name: 'obstructive hydrocephalus',
        icd10Code: 'G91.1',
        snomedCode: '230756002',
        category: 'CSF Disorder',
        severity: 'severe',
      },
      {
        name: 'communicating hydrocephalus',
        icd10Code: 'G91.0',
        snomedCode: '111239007',
        category: 'CSF Disorder',
        severity: 'moderate',
      },

      // Spine Conditions
      {
        name: 'spinal cord injury',
        icd10Code: 'S14.109A',
        snomedCode: '90584004',
        category: 'Spinal Cord Injury',
        severity: 'critical',
      },
      {
        name: 'cervical myelopathy',
        icd10Code: 'M50.00',
        snomedCode: '129642004',
        category: 'Spinal Cord Disorder',
        severity: 'severe',
      },
      {
        name: 'spinal stenosis',
        icd10Code: 'M48.00',
        snomedCode: '76595007',
        category: 'Degenerative Spine',
        severity: 'moderate',
      },
      {
        name: 'herniated disc',
        icd10Code: 'M51.9',
        snomedCode: '73589001',
        category: 'Degenerative Spine',
        severity: 'moderate',
      },
      {
        name: 'disc herniation',
        icd10Code: 'M51.9',
        snomedCode: '73589001',
        category: 'Degenerative Spine',
        severity: 'moderate',
      },
      {
        name: 'spondylolisthesis',
        icd10Code: 'M43.10',
        snomedCode: '274152006',
        category: 'Degenerative Spine',
        severity: 'moderate',
      },
      {
        name: 'spinal fracture',
        icd10Code: 'S32.009A',
        snomedCode: '48944009',
        category: 'Spinal Trauma',
        severity: 'severe',
      },
      {
        name: 'compression fracture',
        icd10Code: 'M48.50XA',
        snomedCode: '28003006',
        category: 'Spinal Trauma',
        severity: 'moderate',
      },
      {
        name: 'spinal tumor',
        icd10Code: 'C72.9',
        snomedCode: '126951007',
        category: 'Spinal Tumor',
        severity: 'severe',
      },

      // Infections
      {
        name: 'brain abscess',
        icd10Code: 'G06.0',
        snomedCode: '44470000',
        category: 'CNS Infection',
        severity: 'critical',
      },
      {
        name: 'meningitis',
        icd10Code: 'G03.9',
        snomedCode: '7180009',
        category: 'CNS Infection',
        severity: 'critical',
      },
      {
        name: 'bacterial meningitis',
        icd10Code: 'G00.9',
        snomedCode: '95883001',
        category: 'CNS Infection',
        severity: 'critical',
      },
      {
        name: 'ventriculitis',
        icd10Code: 'G04.90',
        snomedCode: '20315009',
        category: 'CNS Infection',
        severity: 'critical',
      },
      {
        name: 'osteomyelitis',
        icd10Code: 'M86.9',
        snomedCode: '60168000',
        category: 'Infection',
        severity: 'severe',
      },
      {
        name: 'spinal epidural abscess',
        icd10Code: 'G06.1',
        snomedCode: '36083008',
        category: 'CNS Infection',
        severity: 'critical',
      },

      // Seizure Disorders
      {
        name: 'epilepsy',
        icd10Code: 'G40.909',
        snomedCode: '84757009',
        category: 'Seizure Disorder',
        severity: 'moderate',
      },
      {
        name: 'seizure',
        icd10Code: 'R56.9',
        snomedCode: '91175000',
        category: 'Seizure',
        severity: 'moderate',
      },
      {
        name: 'status epilepticus',
        icd10Code: 'G41.9',
        snomedCode: '230456007',
        category: 'Seizure Disorder',
        severity: 'critical',
      },
      {
        name: 'focal seizure',
        icd10Code: 'G40.209',
        snomedCode: '246545002',
        category: 'Seizure Disorder',
        severity: 'moderate',
      },
      {
        name: 'generalized seizure',
        icd10Code: 'G40.309',
        snomedCode: '367496006',
        category: 'Seizure Disorder',
        severity: 'moderate',
      },

      // Elevated ICP and Brain Swelling
      {
        name: 'increased intracranial pressure',
        icd10Code: 'G93.2',
        snomedCode: '271719001',
        category: 'Increased ICP',
        severity: 'critical',
      },
      {
        name: 'elevated ICP',
        icd10Code: 'G93.2',
        snomedCode: '271719001',
        category: 'Increased ICP',
        severity: 'critical',
      },
      {
        name: 'cerebral edema',
        icd10Code: 'G93.6',
        snomedCode: '20653008',
        category: 'Brain Swelling',
        severity: 'severe',
      },
      {
        name: 'brain herniation',
        icd10Code: 'G93.5',
        snomedCode: '19442004',
        category: 'Herniation Syndrome',
        severity: 'critical',
      },

      // Chiari Malformations
      {
        name: 'Chiari malformation',
        icd10Code: 'Q07.0',
        snomedCode: '253155001',
        category: 'Congenital Anomaly',
        severity: 'moderate',
      },
      {
        name: 'Chiari I malformation',
        icd10Code: 'Q07.00',
        snomedCode: '49727000',
        category: 'Congenital Anomaly',
        severity: 'mild',
      },
      {
        name: 'Chiari II malformation',
        icd10Code: 'Q07.01',
        snomedCode: '34803007',
        category: 'Congenital Anomaly',
        severity: 'severe',
      },
      {
        name: 'syringomyelia',
        icd10Code: 'G95.0',
        snomedCode: '111222008',
        category: 'Spinal Cord Disorder',
        severity: 'moderate',
      },

      // Peripheral Nerve Disorders
      {
        name: 'carpal tunnel syndrome',
        icd10Code: 'G56.00',
        snomedCode: '57406009',
        category: 'Peripheral Nerve Disorder',
        severity: 'mild',
        laterality: 'bilateral',
      },
      {
        name: 'cubital tunnel syndrome',
        icd10Code: 'G56.20',
        snomedCode: '449917004',
        category: 'Peripheral Nerve Disorder',
        severity: 'mild',
      },
      {
        name: 'peripheral neuropathy',
        icd10Code: 'G62.9',
        snomedCode: '42658009',
        category: 'Peripheral Nerve Disorder',
        severity: 'moderate',
      },
      {
        name: 'trigeminal neuralgia',
        icd10Code: 'G50.0',
        snomedCode: '31681005',
        category: 'Cranial Nerve Disorder',
        severity: 'severe',
      },

      // Other Conditions
      {
        name: 'pseudotumor cerebri',
        icd10Code: 'G93.2',
        snomedCode: '271719001',
        category: 'Increased ICP',
        severity: 'moderate',
      },
      {
        name: 'idiopathic intracranial hypertension',
        icd10Code: 'G93.2',
        snomedCode: '68267002',
        category: 'Increased ICP',
        severity: 'moderate',
      },
      {
        name: 'moyamoya disease',
        icd10Code: 'I67.5',
        snomedCode: '7180001',
        category: 'Vascular Disorder',
        severity: 'severe',
      },
    ];

    // Index by diagnosis name (lowercase)
    diagnoses.forEach((diagnosis) => {
      this.diagnosisDictionary.set(diagnosis.name.toLowerCase(), diagnosis);
    });
  }

  /**
   * Initialize procedure dictionary (to be expanded in Day 12)
   */
  private initializeProcedureDictionary(): void {
    const procedures: ProcedureInfo[] = [
      // Cranial Procedures - Tumor Resection
      {
        name: 'craniotomy',
        cptCode: '61510',
        icd10PcsCode: '00B00ZZ',
        category: 'Cranial Surgery',
        approach: 'open',
      },
      {
        name: 'craniotomy for tumor resection',
        cptCode: '61510',
        icd10PcsCode: '00BT0ZZ',
        category: 'Tumor Surgery',
        approach: 'open',
      },
      {
        name: 'craniectomy',
        cptCode: '61500',
        icd10PcsCode: '00B00ZZ',
        category: 'Cranial Surgery',
        approach: 'open',
      },
      {
        name: 'decompressive craniectomy',
        cptCode: '61322',
        icd10PcsCode: '00B00ZZ',
        category: 'Decompression',
        approach: 'open',
        complications: ['postoperative hemorrhage', 'infection', 'CSF leak'],
      },
      {
        name: 'awake craniotomy',
        cptCode: '61531',
        icd10PcsCode: '00B00ZZ',
        category: 'Tumor Surgery',
        approach: 'open',
      },
      {
        name: 'stereotactic biopsy',
        cptCode: '61750',
        icd10PcsCode: '00B03ZX',
        category: 'Diagnostic',
        approach: 'percutaneous',
      },
      {
        name: 'brain biopsy',
        cptCode: '61140',
        icd10PcsCode: '00B00ZX',
        category: 'Diagnostic',
        approach: 'open',
      },

      // Transsphenoidal Surgery
      {
        name: 'transsphenoidal hypophysectomy',
        cptCode: '61548',
        icd10PcsCode: '00BG4ZZ',
        category: 'Pituitary Surgery',
        approach: 'endoscopic',
      },
      {
        name: 'endoscopic transsphenoidal surgery',
        cptCode: '61548',
        icd10PcsCode: '00BG4ZZ',
        category: 'Pituitary Surgery',
        approach: 'endoscopic',
      },
      {
        name: 'pituitary tumor resection',
        cptCode: '61548',
        icd10PcsCode: '00BG4ZZ',
        category: 'Pituitary Surgery',
        approach: 'endoscopic',
      },

      // Vascular Procedures
      {
        name: 'aneurysm clipping',
        cptCode: '61697',
        icd10PcsCode: '03VG0CZ',
        category: 'Vascular Surgery',
        approach: 'open',
      },
      {
        name: 'cerebral aneurysm clipping',
        cptCode: '61697',
        icd10PcsCode: '03VG0CZ',
        category: 'Vascular Surgery',
        approach: 'open',
      },
      {
        name: 'aneurysm coiling',
        cptCode: '61624',
        icd10PcsCode: '03VG3DZ',
        category: 'Vascular Surgery',
        approach: 'endovascular',
      },
      {
        name: 'endovascular coiling',
        cptCode: '61624',
        icd10PcsCode: '03VG3DZ',
        category: 'Vascular Surgery',
        approach: 'endovascular',
      },
      {
        name: 'AVM resection',
        cptCode: '61680',
        icd10PcsCode: '03B00ZZ',
        category: 'Vascular Surgery',
        approach: 'open',
      },
      {
        name: 'arteriovenous malformation resection',
        cptCode: '61680',
        icd10PcsCode: '03B00ZZ',
        category: 'Vascular Surgery',
        approach: 'open',
      },
      {
        name: 'carotid endarterectomy',
        cptCode: '35301',
        icd10PcsCode: '03CH0ZZ',
        category: 'Vascular Surgery',
        approach: 'open',
      },
      {
        name: 'CEA',
        cptCode: '35301',
        icd10PcsCode: '03CH0ZZ',
        category: 'Vascular Surgery',
        approach: 'open',
      },

      // Hematoma Evacuation
      {
        name: 'subdural hematoma evacuation',
        cptCode: '61154',
        icd10PcsCode: '00940ZZ',
        category: 'Hematoma Evacuation',
        approach: 'open',
      },
      {
        name: 'epidural hematoma evacuation',
        cptCode: '61154',
        icd10PcsCode: '00930ZZ',
        category: 'Hematoma Evacuation',
        approach: 'open',
      },
      {
        name: 'burr hole drainage',
        cptCode: '61156',
        icd10PcsCode: '00940ZZ',
        category: 'Hematoma Evacuation',
        approach: 'percutaneous',
      },
      {
        name: 'chronic subdural hematoma drainage',
        cptCode: '61156',
        icd10PcsCode: '00940ZZ',
        category: 'Hematoma Evacuation',
        approach: 'percutaneous',
      },
      {
        name: 'intracerebral hemorrhage evacuation',
        cptCode: '61312',
        icd10PcsCode: '00B00ZZ',
        category: 'Hematoma Evacuation',
        approach: 'open',
      },

      // CSF Diversion
      {
        name: 'ventriculoperitoneal shunt',
        cptCode: '62223',
        icd10PcsCode: '00160J6',
        category: 'CSF Shunt',
        approach: 'open',
        complications: ['shunt malfunction', 'infection', 'overdrainage'],
      },
      {
        name: 'VP shunt',
        cptCode: '62223',
        icd10PcsCode: '00160J6',
        category: 'CSF Shunt',
        approach: 'open',
      },
      {
        name: 'ventriculoatrial shunt',
        cptCode: '62223',
        icd10PcsCode: '00160J5',
        category: 'CSF Shunt',
        approach: 'open',
      },
      {
        name: 'VA shunt',
        cptCode: '62223',
        icd10PcsCode: '00160J5',
        category: 'CSF Shunt',
        approach: 'open',
      },
      {
        name: 'external ventricular drain',
        cptCode: '61020',
        icd10PcsCode: '00960Z0',
        category: 'CSF Drainage',
        approach: 'percutaneous',
      },
      {
        name: 'EVD',
        cptCode: '61020',
        icd10PcsCode: '00960Z0',
        category: 'CSF Drainage',
        approach: 'percutaneous',
      },
      {
        name: 'ventriculostomy',
        cptCode: '61020',
        icd10PcsCode: '00960Z0',
        category: 'CSF Drainage',
        approach: 'percutaneous',
      },
      {
        name: 'endoscopic third ventriculostomy',
        cptCode: '62201',
        icd10PcsCode: '009604Z',
        category: 'CSF Diversion',
        approach: 'endoscopic',
      },
      {
        name: 'ETV',
        cptCode: '62201',
        icd10PcsCode: '009604Z',
        category: 'CSF Diversion',
        approach: 'endoscopic',
      },
      {
        name: 'lumbar drain',
        cptCode: '62272',
        icd10PcsCode: '009U0Z0',
        category: 'CSF Drainage',
        approach: 'percutaneous',
      },
      {
        name: 'lumboperitoneal shunt',
        cptCode: '63740',
        icd10PcsCode: '009U0J6',
        category: 'CSF Shunt',
        approach: 'open',
      },

      // Spine Procedures
      {
        name: 'anterior cervical discectomy and fusion',
        cptCode: '22551',
        icd10PcsCode: '0RG10A0',
        category: 'Spine Surgery',
        approach: 'open',
      },
      {
        name: 'ACDF',
        cptCode: '22551',
        icd10PcsCode: '0RG10A0',
        category: 'Spine Surgery',
        approach: 'open',
      },
      {
        name: 'posterior cervical fusion',
        cptCode: '22600',
        icd10PcsCode: '0RG1070',
        category: 'Spine Surgery',
        approach: 'open',
      },
      {
        name: 'laminectomy',
        cptCode: '63030',
        icd10PcsCode: '00BB0ZZ',
        category: 'Spine Decompression',
        approach: 'open',
      },
      {
        name: 'cervical laminectomy',
        cptCode: '63001',
        icd10PcsCode: '0RB10ZZ',
        category: 'Spine Decompression',
        approach: 'open',
      },
      {
        name: 'lumbar laminectomy',
        cptCode: '63030',
        icd10PcsCode: '0SB20ZZ',
        category: 'Spine Decompression',
        approach: 'open',
      },
      {
        name: 'discectomy',
        cptCode: '63020',
        icd10PcsCode: '0RB20ZZ',
        category: 'Spine Surgery',
        approach: 'open',
      },
      {
        name: 'microdiscectomy',
        cptCode: '63030',
        icd10PcsCode: '0SB20ZZ',
        category: 'Spine Surgery',
        approach: 'open',
      },
      {
        name: 'lumbar fusion',
        cptCode: '22612',
        icd10PcsCode: '0SG10A0',
        category: 'Spine Surgery',
        approach: 'open',
      },
      {
        name: 'posterior lumbar interbody fusion',
        cptCode: '22612',
        icd10PcsCode: '0SG10AJ',
        category: 'Spine Surgery',
        approach: 'open',
      },
      {
        name: 'PLIF',
        cptCode: '22612',
        icd10PcsCode: '0SG10AJ',
        category: 'Spine Surgery',
        approach: 'open',
      },
      {
        name: 'transforaminal lumbar interbody fusion',
        cptCode: '22630',
        icd10PcsCode: '0SG10A0',
        category: 'Spine Surgery',
        approach: 'open',
      },
      {
        name: 'TLIF',
        cptCode: '22630',
        icd10PcsCode: '0SG10A0',
        category: 'Spine Surgery',
        approach: 'open',
      },
      {
        name: 'spinal decompression',
        cptCode: '63030',
        icd10PcsCode: '0SB20ZZ',
        category: 'Spine Decompression',
        approach: 'open',
      },
      {
        name: 'foraminotomy',
        cptCode: '63020',
        icd10PcsCode: '00BB0ZZ',
        category: 'Spine Decompression',
        approach: 'open',
      },

      // Monitoring and Diagnostic
      {
        name: 'ICP monitor placement',
        cptCode: '61107',
        icd10PcsCode: '00H000Z',
        category: 'Monitoring',
        approach: 'percutaneous',
      },
      {
        name: 'intracranial pressure monitor',
        cptCode: '61107',
        icd10PcsCode: '00H000Z',
        category: 'Monitoring',
        approach: 'percutaneous',
      },
      {
        name: 'brain oxygen monitor',
        cptCode: '61107',
        icd10PcsCode: '00H004Z',
        category: 'Monitoring',
        approach: 'percutaneous',
      },

      // Peripheral Nerve
      {
        name: 'carpal tunnel release',
        cptCode: '64721',
        icd10PcsCode: '01N60ZZ',
        category: 'Peripheral Nerve Surgery',
        approach: 'open',
      },
      {
        name: 'cubital tunnel release',
        cptCode: '64718',
        icd10PcsCode: '01N40ZZ',
        category: 'Peripheral Nerve Surgery',
        approach: 'open',
      },
      {
        name: 'ulnar nerve transposition',
        cptCode: '64718',
        icd10PcsCode: '01S40ZZ',
        category: 'Peripheral Nerve Surgery',
        approach: 'open',
      },
      {
        name: 'microvascular decompression',
        cptCode: '61458',
        icd10PcsCode: '00N00ZZ',
        category: 'Cranial Nerve Surgery',
        approach: 'open',
      },
      {
        name: 'MVD',
        cptCode: '61458',
        icd10PcsCode: '00N00ZZ',
        category: 'Cranial Nerve Surgery',
        approach: 'open',
      },

      // Deep Brain Stimulation
      {
        name: 'deep brain stimulator placement',
        cptCode: '61867',
        icd10PcsCode: '00H00MZ',
        category: 'Functional Neurosurgery',
        approach: 'stereotactic',
      },
      {
        name: 'DBS placement',
        cptCode: '61867',
        icd10PcsCode: '00H00MZ',
        category: 'Functional Neurosurgery',
        approach: 'stereotactic',
      },

      // Minimally Invasive
      {
        name: 'endoscopic skull base surgery',
        cptCode: '61580',
        icd10PcsCode: '00B04ZZ',
        category: 'Skull Base Surgery',
        approach: 'endoscopic',
      },
      {
        name: 'neuroendoscopy',
        cptCode: '62160',
        icd10PcsCode: '00J04ZZ',
        category: 'Endoscopic',
        approach: 'endoscopic',
      },

      // Stereotactic Radiosurgery
      {
        name: 'gamma knife radiosurgery',
        cptCode: '61796',
        category: 'Radiosurgery',
        approach: 'stereotactic',
      },
      {
        name: 'stereotactic radiosurgery',
        cptCode: '61796',
        category: 'Radiosurgery',
        approach: 'stereotactic',
      },
      {
        name: 'CyberKnife',
        cptCode: '61796',
        category: 'Radiosurgery',
        approach: 'stereotactic',
      },
    ];

    // Index by procedure name (lowercase)
    procedures.forEach((procedure) => {
      this.procedureDictionary.set(procedure.name.toLowerCase(), procedure);
    });
  }

  /**
   * Normalize drug name to generic form
   */
  normalizeDrugName(drugName: string): TermMatch | null {
    const normalized = drugName.toLowerCase().trim();
    
    // Check for exact match
    const exactMatch = this.drugDictionary.get(normalized);
    if (exactMatch) {
      return {
        term: drugName,
        confidence: 1.0,
        matchType: 'exact',
        standardizedTerm: exactMatch.generic,
        metadata: exactMatch,
      };
    }

    // Try fuzzy matching
    const fuzzyMatch = this.fuzzyMatchDrug(normalized);
    if (fuzzyMatch) {
      return fuzzyMatch;
    }

    return null;
  }

  /**
   * Fuzzy match drug name using Levenshtein distance
   */
  private fuzzyMatchDrug(term: string): TermMatch | null {
    let bestMatch: { drug: DrugInfo; distance: number; matchedKey: string } | null = null;
    let minDistance = Infinity;

    for (const [key, drug] of this.drugDictionary.entries()) {
      const distance = this.levenshteinDistance(term, key);
      
      // Allow up to 2 character differences for fuzzy matching
      if (distance < minDistance && distance <= 2) {
        minDistance = distance;
        bestMatch = { drug, distance, matchedKey: key };
      }
    }

    if (bestMatch && minDistance <= 2) {
      const confidence = 1.0 - (minDistance / Math.max(term.length, bestMatch.matchedKey.length));
      return {
        term,
        confidence: Math.max(confidence, 0.5), // Minimum 0.5 for fuzzy matches
        matchType: 'fuzzy',
        standardizedTerm: bestMatch.drug.generic,
        metadata: bestMatch.drug,
      };
    }

    return null;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Get drug information by generic or brand name
   */
  getDrugInfo(drugName: string): DrugInfo | null {
    const match = this.normalizeDrugName(drugName);
    return match ? (match.metadata as DrugInfo) : null;
  }

  /**
   * Validate route of administration for a drug
   */
  validateRoute(drugName: string, route: string): boolean {
    const drugInfo = this.getDrugInfo(drugName);
    if (!drugInfo) return false;

    const normalizedRoute = route.toLowerCase().trim();
    return drugInfo.routes.some((r) => r.toLowerCase() === normalizedRoute);
  }

  /**
   * Get all drugs in a specific class
   */
  getDrugsByClass(drugClass: string): DrugInfo[] {
    const results: DrugInfo[] = [];
    const seen = new Set<string>();

    for (const drug of this.drugDictionary.values()) {
      if (drug.drugClass === drugClass && !seen.has(drug.generic)) {
        results.push(drug);
        seen.add(drug.generic);
      }
    }

    return results;
  }

  /**
   * Get all available drug classes
   */
  getDrugClasses(): string[] {
    const classes = new Set<string>();
    
    for (const drug of this.drugDictionary.values()) {
      classes.add(drug.drugClass);
    }

    return Array.from(classes).sort();
  }

  /**
   * Get dictionary statistics
   */
  getStatistics(): {
    totalDrugs: number;
    totalDiagnoses: number;
    totalProcedures: number;
    drugClasses: number;
  } {
    const uniqueDrugs = new Set<string>();
    
    for (const drug of this.drugDictionary.values()) {
      uniqueDrugs.add(drug.generic);
    }

    return {
      totalDrugs: uniqueDrugs.size,
      totalDiagnoses: this.diagnosisDictionary.size,
      totalProcedures: this.procedureDictionary.size,
      drugClasses: this.getDrugClasses().length,
    };
  }

  /**
   * Normalize diagnosis name
   */
  normalizeDiagnosisName(diagnosisName: string): TermMatch | null {
    const normalized = diagnosisName.toLowerCase().trim();
    
    // Check for exact match
    const exactMatch = this.diagnosisDictionary.get(normalized);
    if (exactMatch) {
      return {
        term: diagnosisName,
        confidence: 1.0,
        matchType: 'exact',
        standardizedTerm: exactMatch.name,
        metadata: exactMatch,
      };
    }

    // Try fuzzy matching
    const fuzzyMatch = this.fuzzyMatchDiagnosis(normalized);
    if (fuzzyMatch) {
      return fuzzyMatch;
    }

    return null;
  }

  /**
   * Fuzzy match diagnosis name
   */
  private fuzzyMatchDiagnosis(term: string): TermMatch | null {
    let bestMatch: { diagnosis: DiagnosisInfo; distance: number; matchedKey: string } | null = null;
    let minDistance = Infinity;

    for (const [key, diagnosis] of this.diagnosisDictionary.entries()) {
      const distance = this.levenshteinDistance(term, key);
      
      // Allow up to 3 character differences for longer diagnosis names
      const maxDistance = Math.min(3, Math.floor(key.length * 0.2));
      
      if (distance < minDistance && distance <= maxDistance) {
        minDistance = distance;
        bestMatch = { diagnosis, distance, matchedKey: key };
      }
    }

    if (bestMatch && minDistance <= 3) {
      const confidence = 1.0 - (minDistance / Math.max(term.length, bestMatch.matchedKey.length));
      return {
        term,
        confidence: Math.max(confidence, 0.5),
        matchType: 'fuzzy',
        standardizedTerm: bestMatch.diagnosis.name,
        metadata: bestMatch.diagnosis,
      };
    }

    return null;
  }

  /**
   * Get diagnosis information
   */
  getDiagnosisInfo(diagnosisName: string): DiagnosisInfo | null {
    const match = this.normalizeDiagnosisName(diagnosisName);
    return match ? (match.metadata as DiagnosisInfo) : null;
  }

  /**
   * Get all diagnoses in a category
   */
  getDiagnosesByCategory(category: string): DiagnosisInfo[] {
    const results: DiagnosisInfo[] = [];
    
    for (const diagnosis of this.diagnosisDictionary.values()) {
      if (diagnosis.category === category) {
        results.push(diagnosis);
      }
    }

    return results;
  }

  /**
   * Get all diagnosis categories
   */
  getDiagnosisCategories(): string[] {
    const categories = new Set<string>();
    
    for (const diagnosis of this.diagnosisDictionary.values()) {
      categories.add(diagnosis.category);
    }

    return Array.from(categories).sort();
  }

  /**
   * Normalize procedure name
   */
  normalizeProcedureName(procedureName: string): TermMatch | null {
    const normalized = procedureName.toLowerCase().trim();
    
    // Check for exact match
    const exactMatch = this.procedureDictionary.get(normalized);
    if (exactMatch) {
      return {
        term: procedureName,
        confidence: 1.0,
        matchType: 'exact',
        standardizedTerm: exactMatch.name,
        metadata: exactMatch,
      };
    }

    // Try fuzzy matching
    const fuzzyMatch = this.fuzzyMatchProcedure(normalized);
    if (fuzzyMatch) {
      return fuzzyMatch;
    }

    return null;
  }

  /**
   * Fuzzy match procedure name
   */
  private fuzzyMatchProcedure(term: string): TermMatch | null {
    let bestMatch: { procedure: ProcedureInfo; distance: number; matchedKey: string } | null = null;
    let minDistance = Infinity;

    for (const [key, procedure] of this.procedureDictionary.entries()) {
      const distance = this.levenshteinDistance(term, key);
      
      // Allow up to 3 character differences for longer procedure names
      const maxDistance = Math.min(3, Math.floor(key.length * 0.2));
      
      if (distance < minDistance && distance <= maxDistance) {
        minDistance = distance;
        bestMatch = { procedure, distance, matchedKey: key };
      }
    }

    if (bestMatch && minDistance <= 3) {
      const confidence = 1.0 - (minDistance / Math.max(term.length, bestMatch.matchedKey.length));
      return {
        term,
        confidence: Math.max(confidence, 0.5),
        matchType: 'fuzzy',
        standardizedTerm: bestMatch.procedure.name,
        metadata: bestMatch.procedure,
      };
    }

    return null;
  }

  /**
   * Get procedure information
   */
  getProcedureInfo(procedureName: string): ProcedureInfo | null {
    const match = this.normalizeProcedureName(procedureName);
    return match ? (match.metadata as ProcedureInfo) : null;
  }

  /**
   * Get all procedures in a category
   */
  getProceduresByCategory(category: string): ProcedureInfo[] {
    const results: ProcedureInfo[] = [];
    
    for (const procedure of this.procedureDictionary.values()) {
      if (procedure.category === category) {
        results.push(procedure);
      }
    }

    return results;
  }

  /**
   * Get all procedure categories
   */
  getProcedureCategories(): string[] {
    const categories = new Set<string>();
    
    for (const procedure of this.procedureDictionary.values()) {
      categories.add(procedure.category);
    }

    return Array.from(categories).sort();
  }
}

// Export singleton instance
export const medicalTerminologyService = new MedicalTerminologyService();
