// Türkiye'deki Araç Markaları, Modelleri, Motor ve Paket Seçenekleri
// Kapsamlı model bazlı motor ve paket verileri ayrı JSON dosyalarından import edilir.
import modelEnginesData from './catalog/modelEngines.json';
import modelPackagesData from './catalog/modelPackages.json';

export const carBrands = [
  'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'BYD', 'Cadillac', 'Chery', 
  'Chevrolet', 'Citroen', 'Cupra', 'Dacia', 'Daewoo', 'Daihatsu', 'DS Automobiles',
  'Ferrari', 'Fiat', 'Ford', 'Geely', 'Honda', 'Hyundai', 'Infiniti', 'Isuzu',
  'Iveco', 'Jaguar', 'Jeep', 'Kia', 'Lada', 'Lamborghini', 'Lancia', 'Land Rover',
  'Lexus', 'Lincoln', 'Lotus', 'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz',
  'MG', 'Mini', 'Mitsubishi', 'Nissan', 'Opel', 'Peugeot', 'Porsche', 'Renault',
  'Rolls-Royce', 'Rover', 'Saab', 'Seat', 'Skoda', 'Smart', 'SsangYong', 'Subaru',
  'Suzuki', 'Tata', 'Tesla', 'Togg', 'Toyota', 'Volkswagen', 'Volvo'
];

export const carModels = {
  'Alfa Romeo': ['Giulia', 'Giulietta', 'Stelvio', 'Tonale', '147', '156', '159', 'Brera', 'MiTo', 'Spider'],
  'Aston Martin': ['DB11', 'DB9', 'DBS', 'DBX', 'Rapide', 'Vantage', 'Vanquish'],
  'Audi': [
    'A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
    'Q2', 'Q3', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'Q8 e-tron',
    'e-tron', 'e-tron GT',
    'RS3', 'RS4', 'RS5', 'RS6', 'RS7', 'RS Q3', 'RS Q8',
    'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'SQ5', 'SQ7', 'SQ8',
    'TT', 'TT RS', 'TTS', 'R8'
  ],
  'Bentley': ['Bentayga', 'Continental GT', 'Flying Spur', 'Mulsanne'],
  'BMW': [
    '1 Serisi', '2 Serisi', '2 Serisi Active Tourer', '2 Serisi Gran Coupe',
    '3 Serisi', '4 Serisi', '5 Serisi', '6 Serisi', '7 Serisi', '8 Serisi',
    'i3', 'i4', 'i5', 'i7', 'iX', 'iX1', 'iX3',
    'M2', 'M3', 'M4', 'M5', 'M8',
    'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7',
    'XM', 'Z4'
  ],
  'BYD': ['Atto 3', 'Han', 'Seal', 'Tang', 'Dolphin'],
  'Cadillac': ['CT4', 'CT5', 'Escalade', 'XT4', 'XT5', 'XT6', 'Lyriq'],
  'Chery': ['Tiggo 4 Pro', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'Arrizo 6'],
  'Chevrolet': ['Aveo', 'Camaro', 'Captiva', 'Corvette', 'Cruze', 'Equinox', 'Malibu', 'Spark', 'Tahoe', 'Trailblazer', 'Trax'],
  'Citroen': [
    'Berlingo', 'C-Elysee', 'C1', 'C3', 'C3 Aircross', 'C4', 'C4 Cactus', 'C4 Picasso',
    'C4 X', 'C5', 'C5 Aircross', 'C5 X', 'DS3', 'DS4', 'DS5', 'e-C4', 'Jumper', 'Jumpy', 'Nemo', 'SpaceTourer'
  ],
  'Cupra': ['Ateca', 'Born', 'Formentor', 'Leon', 'Tavascan'],
  'Dacia': ['Dokker', 'Duster', 'Jogger', 'Lodgy', 'Logan', 'Sandero', 'Spring'],
  'DS Automobiles': ['DS 3', 'DS 3 Crossback', 'DS 4', 'DS 7', 'DS 9'],
  'Ferrari': ['296 GTB', '488', '812', 'F8 Tributo', 'Portofino', 'Purosangue', 'Roma', 'SF90'],
  'Fiat': [
    '124 Spider', '500', '500C', '500L', '500X', 'Doblo', 'Ducato', 'Egea',
    'Fiorino', 'Linea', 'Panda', 'Punto', 'Scudo', 'Tipo'
  ],
  'Ford': [
    'B-Max', 'C-Max', 'Connect', 'Courier', 'EcoSport', 'Edge', 'Escape',
    'Explorer', 'F-150', 'Fiesta', 'Focus', 'Galaxy', 'Kuga', 'Mondeo',
    'Mustang', 'Mustang Mach-E', 'Puma', 'Ranger', 'S-Max', 'Tourneo Connect',
    'Tourneo Courier', 'Tourneo Custom', 'Transit', 'Transit Connect', 'Transit Custom'
  ],
  'Geely': ['Coolray', 'Emgrand', 'Monjaro', 'Okavango'],
  'Honda': [
    'Accord', 'City', 'Civic', 'CR-V', 'e:Ny1', 'HR-V', 'Jazz', 'NSX', 'ZR-V'
  ],
  'Hyundai': [
    'Accent', 'Bayon', 'Elantra', 'Getz', 'i10', 'i20', 'i30', 'i40',
    'Ioniq', 'Ioniq 5', 'Ioniq 6', 'ix20', 'ix35', 'Kona', 'Kona Electric',
    'Nexo', 'Santa Fe', 'Staria', 'Tucson', 'Venue'
  ],
  'Infiniti': ['Q30', 'Q50', 'Q60', 'Q70', 'QX30', 'QX50', 'QX55', 'QX60', 'QX70', 'QX80'],
  'Isuzu': ['D-Max'],
  'Jaguar': ['E-Pace', 'F-Pace', 'F-Type', 'I-Pace', 'XE', 'XF', 'XJ'],
  'Jeep': ['Avenger', 'Cherokee', 'Commander', 'Compass', 'Gladiator', 'Grand Cherokee', 'Renegade', 'Wrangler'],
  'Kia': [
    'Carens', 'Carnival', 'Ceed', 'Cerato', 'EV6', 'EV9', 'Niro', 'Optima',
    'Picanto', 'ProCeed', 'Rio', 'Seltos', 'Sorento', 'Soul', 'Sportage',
    'Stinger', 'Stonic', 'Venga', 'XCeed'
  ],
  'Lamborghini': ['Aventador', 'Huracan', 'Revuelto', 'Urus'],
  'Land Rover': [
    'Defender', 'Discovery', 'Discovery Sport', 'Freelander',
    'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'
  ],
  'Lexus': ['CT', 'ES', 'GS', 'IS', 'LC', 'LS', 'LX', 'NX', 'RC', 'RX', 'RZ', 'UX'],
  'Maserati': ['Ghibli', 'GranCabrio', 'GranTurismo', 'Grecale', 'Levante', 'MC20', 'Quattroporte'],
  'Mazda': ['2', '3', '6', 'CX-3', 'CX-30', 'CX-5', 'CX-60', 'CX-9', 'MX-30', 'MX-5'],
  'McLaren': ['540C', '570S', '600LT', '720S', 'Artura', 'GT'],
  'Mercedes-Benz': [
    'A Serisi', 'B Serisi', 'C Serisi', 'CLA', 'CLA Shooting Brake', 'CLS',
    'E Serisi', 'EQA', 'EQB', 'EQC', 'EQE', 'EQE SUV', 'EQS', 'EQS SUV', 'EQV',
    'G Serisi', 'GLA', 'GLB', 'GLC', 'GLC Coupe', 'GLE', 'GLE Coupe', 'GLS',
    'GT', 'S Serisi', 'SL', 'SLC', 'Sprinter', 'V Serisi', 'Vito', 'X Serisi',
    'AMG GT', 'AMG One', 'Citan', 'Maybach S Serisi'
  ],
  'MG': ['4', '5', 'HS', 'Marvel R', 'MG4', 'ZS', 'ZS EV'],
  'Mini': ['Clubman', 'Convertible', 'Countryman', 'Coupe', 'Hatch', 'Paceman'],
  'Mitsubishi': ['ASX', 'Colt', 'Eclipse Cross', 'L200', 'Lancer', 'Outlander', 'Pajero', 'Space Star'],
  'Nissan': [
    'Ariya', 'GT-R', 'Juke', 'Leaf', 'Micra', 'Murano', 'Navara', 'Note',
    'NV200', 'NV300', 'Pathfinder', 'Primastar', 'Pulsar', 'Qashqai', 'Townstar', 'X-Trail'
  ],
  'Opel': [
    'Adam', 'Ampera', 'Astra', 'Combo', 'Corsa', 'Crossland', 'Crossland X',
    'Grandland', 'Grandland X', 'Insignia', 'Karl', 'Meriva', 'Mokka', 'Movano',
    'Vivaro', 'Zafira'
  ],
  'Peugeot': [
    '108', '2008', '206', '207', '208', '3008', '301', '308', '408', '5008',
    '508', 'Bipper', 'Boxer', 'e-2008', 'e-208', 'e-308', 'e-Expert', 'Expert',
    'Partner', 'Rifter', 'Traveller'
  ],
  'Porsche': [
    '718 Boxster', '718 Cayman', '911', 'Cayenne', 'Cayenne Coupe', 'Macan',
    'Panamera', 'Taycan', 'Taycan Cross Turismo'
  ],
  'Renault': [
    'Arkana', 'Austral', 'Captur', 'Clio', 'Espace', 'Express', 'Fluence',
    'Grand Scenic', 'Kadjar', 'Kangoo', 'Koleos', 'Laguna', 'Latitude',
    'Master', 'Megane', 'Megane E-Tech', 'Modus', 'Rafale', 'Scenic', 'Symbol',
    'Taliant', 'Talisman', 'Trafic', 'Twingo', 'Zoe'
  ],
  'Seat': ['Alhambra', 'Altea', 'Arona', 'Ateca', 'Ibiza', 'Leon', 'Mii', 'Tarraco', 'Toledo'],
  'Skoda': [
    'Citigo', 'Enyaq', 'Fabia', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia',
    'Rapid', 'Roomster', 'Scala', 'Superb', 'Yeti'
  ],
  'Smart': ['EQ forfour', 'EQ fortwo', 'forfour', 'fortwo'],
  'SsangYong': ['Actyon', 'Korando', 'Kyron', 'Musso', 'Rexton', 'Tivoli', 'Torres', 'XLV'],
  'Subaru': ['BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Levorg', 'Outback', 'Solterra', 'WRX', 'XV'],
  'Suzuki': ['Across', 'Alto', 'Baleno', 'Celerio', 'Ignis', 'Jimny', 'S-Cross', 'Splash', 'Swift', 'SX4', 'Vitara'],
  'Tata': ['Nexon'],
  'Tesla': ['Model 3', 'Model S', 'Model X', 'Model Y', 'Cybertruck'],
  'Togg': ['T10F', 'T10X'],
  'Toyota': [
    'Auris', 'Avensis', 'Aygo', 'Aygo X', 'bZ4X', 'C-HR', 'Camry', 'Corolla',
    'Corolla Cross', 'GR86', 'Highlander', 'Hilux', 'Land Cruiser', 'Mirai',
    'Prius', 'Proace', 'Proace City', 'Proace Verso', 'RAV4', 'Supra',
    'Verso', 'Yaris', 'Yaris Cross'
  ],
  'Volkswagen': [
    'Amarok', 'Arteon', 'Beetle', 'Bora', 'Caddy', 'California', 'Caravelle',
    'CC', 'Crafter', 'e-Golf', 'Golf', 'ID.3', 'ID.4', 'ID.5', 'ID.7', 'ID. Buzz',
    'Jetta', 'Multivan', 'Passat', 'Polo', 'Scirocco', 'Sharan', 'T-Cross',
    'T-Roc', 'Taigo', 'Tiguan', 'Touareg', 'Touran', 'Transporter', 'Up'
  ],
  'Volvo': [
    'C30', 'C40', 'C70', 'EX30', 'EX90', 'S40', 'S60', 'S80', 'S90',
    'V40', 'V50', 'V60', 'V70', 'V90', 'XC40', 'XC60', 'XC70', 'XC90'
  ]
};

// Motor Hacimleri
export const engineTypes = [
  '0.9', '1.0', '1.0 TSI', '1.0 EcoBoost', '1.0 T-GDI',
  '1.2', '1.2 PureTech', '1.2 TSI', '1.2 TCe',
  '1.3', '1.3 T-GDI', '1.3 MultiJet',
  '1.4', '1.4 TSI', '1.4 TDI', '1.4 T-GDI', '1.4 Fire',
  '1.5', '1.5 TSI', '1.5 TDI', '1.5 BlueHDi', '1.5 EcoBlue', '1.5 dCi', '1.5 T-GDI', '1.5 VTEC',
  '1.6', '1.6 TDI', '1.6 TSI', '1.6 BlueHDi', '1.6 e-HDi', '1.6 dCi', '1.6 T-GDI', '1.6 CRDI', '1.6 MultiJet', '1.6 EcoBoost',
  '1.7', '1.7 CRDI',
  '1.8', '1.8 TSI', '1.8 TFSI', '1.8 T',
  '2.0', '2.0 TDI', '2.0 TSI', '2.0 TFSI', '2.0 BlueHDi', '2.0 dCi', '2.0 EcoBlue', '2.0 EcoBoost', '2.0 CRDI', '2.0 T-GDI', '2.0 D', '2.0 Skyactiv-G', '2.0 Skyactiv-D',
  '2.1', '2.1 CDI',
  '2.2', '2.2 CDI', '2.2 CRDI', '2.2 D', '2.2 dCi', '2.2 TDCi',
  '2.3', '2.3 EcoBoost', '2.3 dCi',
  '2.4', '2.4 D', '2.4 D5',
  '2.5', '2.5 TSI', '2.5 TFSI', '2.5 T', '2.5 T5', '2.5 Skyactiv-G',
  '2.7', '2.7 CDI', '2.7 TDI',
  '2.8', '2.8 TDI',
  '2.9', '2.9 TFSI',
  '3.0', '3.0 TDI', '3.0 TFSI', '3.0 TSI', '3.0 CDI', '3.0 D', '3.0 V6', '3.0 BiTurbo', '3.0 Skyactiv-X',
  '3.2', '3.2 V6',
  '3.3', '3.3 T-GDI',
  '3.5', '3.5 V6',
  '3.6', '3.6 TSI', '3.6 FSI',
  '3.8', '3.8 V6',
  '4.0', '4.0 TDI', '4.0 TFSI', '4.0 V8', '4.0 BiTurbo',
  '4.2', '4.2 FSI', '4.2 TDI',
  '4.4', '4.4 V8',
  '5.0', '5.0 V8', '5.0 V10',
  '5.2', '5.2 FSI', '5.2 V10',
  '5.5', '5.5 V8',
  '6.0', '6.0 W12', '6.0 V12',
  '6.2', '6.2 V8',
  '6.3', '6.3 V8',
  '6.5', '6.5 V12',
  // Elektrikli
  'Elektrik', 'Elektrik (Single Motor)', 'Elektrik (Dual Motor)', 'Elektrik (Tri Motor)',
  // Hibrit
  'Hibrit', 'Plug-in Hibrit', 'Mild Hibrit'
];

// Araç Paketleri/Versiyonları
export const packageTypes = {
  'Genel': [
    'Base', 'Comfort', 'Style', 'Elegance', 'Executive', 'Premium', 'Sport',
    'Luxury', 'First Edition', 'Launch Edition', 'Limited', 'Special Edition'
  ],
  'Audi': [
    'Base', 'Design', 'Advanced', 'S line', 'S line Sport', 'Design Selection',
    'Quattro', 'Black Edition', 'Competition', 'Vorsprung'
  ],
  'BMW': [
    'Base', 'Advantage', 'Sport Line', 'Luxury Line', 'M Sport', 'M Sport Pro',
    'M Performance', 'xLine', 'Individual', 'Pure'
  ],
  'Mercedes-Benz': [
    'Base', 'Style', 'Progressive', 'AMG Line', 'AMG Line Premium', 'AMG Line Premium Plus',
    'Night Edition', 'Exclusive', 'Avantgarde', 'Edition 1', 'Final Edition'
  ],
  'Volkswagen': [
    'Base', 'Trendline', 'Comfortline', 'Highline', 'R-Line', 'GTI', 'GTD', 'GTE',
    'Style', 'Life', 'Elegance', 'Move'
  ],
  'Toyota': [
    'Base', 'Active', 'Comfort', 'Dream', 'Elegant', 'Flame', 'Passion', 'Premium',
    'Adventure', 'GR Sport', 'GR-S'
  ],
  'Hyundai': [
    'Base', 'Jump', 'Team', 'Style', 'Style Plus', 'Elite', 'Elite Plus', 'Prime',
    'N Line', 'N Performance', 'Calligraphy'
  ],
  'Kia': [
    'Base', 'Cool', 'Concept', 'Premium', 'Prestige', 'GT-Line', 'GT-Line S',
    'GT', 'X-Line'
  ],
  'Ford': [
    'Base', 'Trend', 'Trend X', 'Titanium', 'Titanium X', 'ST-Line', 'ST-Line X',
    'Vignale', 'Active', 'ST', 'MS-RT'
  ],
  'Renault': [
    'Base', 'Joy', 'Touch', 'Icon', 'Intens', 'RS Line', 'E-Tech', 'Initiale Paris',
    'Zen', 'Limited'
  ],
  'Peugeot': [
    'Base', 'Active', 'Active Pack', 'Allure', 'Allure Pack', 'GT', 'GT Pack',
    'Roadtrip', 'First Edition'
  ],
  'Fiat': [
    'Base', 'Easy', 'Lounge', 'Cross', 'Sport', 'Star', 'Mirror', 'S-Design',
    'Urban', 'City Cross', 'Rockstar'
  ],
  'Opel': [
    'Base', 'Edition', 'Elegance', 'GS Line', 'Ultimate', 'Business Edition',
    'OPC Line', 'GSi'
  ],
  'Skoda': [
    'Base', 'Active', 'Ambition', 'Style', 'L&K', 'Sportline', 'Scout', 'RS',
    'Monte Carlo'
  ],
  'Seat': [
    'Base', 'Reference', 'Style', 'Xcellence', 'FR', 'FR Sport', 'Cupra'
  ],
  'Volvo': [
    'Base', 'Momentum', 'Inscription', 'R-Design', 'Cross Country', 'Polestar Engineered',
    'Plus', 'Ultimate'
  ],
  'Honda': [
    'Base', 'Comfort', 'Executive', 'Sport', 'Elegance', 'Advance', 'e:HEV'
  ],
  'Nissan': [
    'Base', 'Visia', 'Acenta', 'N-Connecta', 'Tekna', 'Tekna+', 'Nismo'
  ],
  'Mazda': [
    'Base', 'Prime-Line', 'Center-Line', 'Exclusive-Line', 'Sports-Line', 'Signature',
    'Homura', 'Takumi', 'Newground'
  ],
  'Citroen': [
    'Base', 'Feel', 'Feel Pack', 'Shine', 'Shine Pack', 'C-Series', 'Origins', 'Flair'
  ],
  'Dacia': [
    'Base', 'Essential', 'Expression', 'Extreme', 'Journey', 'SL Extreme'
  ],
  'Jeep': [
    'Base', 'Sport', 'Longitude', 'Limited', 'Overland', 'Trailhawk', 'Summit',
    'Sahara', 'Rubicon', 'High Altitude'
  ],
  'Land Rover': [
    'Base', 'S', 'SE', 'HSE', 'Autobiography', 'First Edition', 'SVR', 'Dynamic',
    'R-Dynamic'
  ],
  'Porsche': [
    'Base', 'T', 'S', 'GTS', 'Turbo', 'Turbo S', 'GT3', 'GT3 RS', 'Carrera',
    'Carrera S', 'Carrera 4S'
  ],
  'Tesla': [
    'Standard Range', 'Standard Range Plus', 'Long Range', 'Performance', 'Plaid'
  ],
  'Togg': [
    'Base', 'Standard Range', 'Long Range', 'Performance'
  ]
};

// Vites Türleri
export const gearTypes = [
  'Manuel',
  'Otomatik',
  'Yarı Otomatik',
  'CVT (Sürekli Değişken)',
  'DSG (Çift Kavrama)',
  'S-Tronic',
  'PDK',
  'Tiptronic',
  'Powershift',
  'EDC',
  'Elektrikli (Tek Vites)'
];

// Yakıt Türleri
export const fuelTypes = [
  'Benzin',
  'Dizel',
  'LPG',
  'Benzin + LPG',
  'Hibrit (Benzin)',
  'Hibrit (Dizel)',
  'Plug-in Hibrit',
  'Elektrik',
  'Mild Hibrit (Benzin)',
  'Mild Hibrit (Dizel)',
  'Hidrojen'
];

// Kasa Tipleri
export const vehicleTypes = [
  'Sedan',
  'Hatchback',
  'Station Wagon (SW)',
  'SUV',
  'Crossover',
  'Coupe',
  'Cabrio / Roadster',
  'Pick-up',
  'Minivan / MPV',
  'Panelvan',
  'Kamyonet',
  'Limuzin'
];

// Model Yılları (1990'dan günümüze)
export const modelYears = Array.from({ length: new Date().getFullYear() - 1989 + 1 }, (_, i) => 1990 + i).reverse();

// Renk Seçenekleri
export const colorOptions = [
  'Beyaz', 'Siyah', 'Gri', 'Gümüş', 'Kırmızı', 'Mavi', 'Lacivert',
  'Yeşil', 'Kahverengi', 'Bej', 'Bordo', 'Turuncu', 'Sarı', 'Mor',
  'Pembe', 'Bronz', 'Altın', 'Şampanya', 'Antrasit', 'Metalik Gri',
  'İnci Beyazı', 'Kar Beyazı', 'Mat Siyah', 'Mat Gri'
];


// Model bazlı motor seçenekleri (JSON'dan import edilir) - Marka -> Model -> Motorlar
export const modelEngineTypes = modelEnginesData;

// Model bazlı paket seçenekleri (JSON'dan import edilir) - Marka -> Model -> Paketler
export const modelPackageTypes = modelPackagesData;

// Yardımcı fonksiyon: Model bazlı motor getir
// Önce model-bazlı spesifik liste aranır; yoksa null döner (UI tam listeye fallback eder)
export const getEnginesForModel = (brand, model) => {
  if (brand && model && modelEngineTypes[brand]?.[model]) {
    return modelEngineTypes[brand][model];
  }
  return null;
};

// Yardımcı fonksiyon: Model bazlı paket getir
// 1) Model-bazlı spesifik paketler
// 2) Marka geneli paket listesi (packageTypes[brand])
// 3) Genel paket listesi
export const getPackagesForModel = (brand, model) => {
  if (brand && model && modelPackageTypes[brand]?.[model]) {
    return modelPackageTypes[brand][model];
  }
  if (brand && packageTypes[brand]) {
    return packageTypes[brand];
  }
  return packageTypes['Genel'] || [];
};
