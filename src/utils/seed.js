const Car = require('../models/Car');
const Admin = require('../models/Admin');

const defaultCars = [
  {
    slug: 'bmw-3-series-2022',
    make: 'BMW',
    model: '3 Series 320d M Sport',
    year: 2022,
    mileage: 22400,
    transmission: 'Automatic',
    fuel: 'Diesel',
    price: 26995,
    image: '/images/car-bmw-B_KIGLdL.jpg',
    images: ['/images/car-bmw-B_KIGLdL.jpg'],
    body: 'Saloon',
    description:
      'A beautifully presented 3 Series with a refined automatic drive, M Sport styling and a carefully selected specification. Viewings and test drives are welcome by appointment.',
    featured: true,
  },
  {
    slug: 'audi-a4-avant-2021',
    make: 'Audi',
    model: 'A4 Avant 2.0 TDI S line',
    year: 2021,
    mileage: 31500,
    transmission: 'Automatic',
    fuel: 'Diesel',
    price: 23995,
    image: '/images/car-audi-BOSXoxSu.jpg',
    images: ['/images/car-audi-BOSXoxSu.jpg'],
    body: 'Estate',
    description:
      'A practical and polished A4 Avant with generous luggage space and an easy, composed drive. A smart choice for everyday journeys and longer trips alike.',
    featured: true,
  },
  {
    slug: 'volvo-xc60-2022',
    make: 'Volvo',
    model: 'XC60 B5 Plus Dark',
    year: 2022,
    mileage: 19800,
    transmission: 'Automatic',
    fuel: 'Hybrid',
    price: 34995,
    image: '/images/car-volvo-C838ZXoW.jpg',
    images: ['/images/car-volvo-C838ZXoW.jpg'],
    body: 'SUV',
    description:
      'Comfortable, confident and ready for family life, this XC60 pairs a spacious cabin with a smooth mild-hybrid powertrain and distinctive Scandinavian design.',
    featured: true,
  },
  {
    slug: 'mercedes-c-class-2021',
    make: 'Mercedes-Benz',
    model: 'C-Class C200 AMG Line',
    year: 2021,
    mileage: 28700,
    transmission: 'Automatic',
    fuel: 'Petrol',
    price: 25995,
    image: '/images/car-mercedes-BgFZ1ks8.jpg',
    images: ['/images/car-mercedes-BgFZ1ks8.jpg'],
    body: 'Saloon',
    description:
      'An elegant C-Class with AMG Line detailing, a smooth automatic transmission and an inviting interior. Contact our team to arrange a closer look.',
    featured: false,
  },
];

const seedData = async () => {
  try {
    // 1. Seed Admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@fawmondgalaxy.co.uk';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    let admin = await Admin.findOne({ email: adminEmail });
    if (!admin) {
      admin = await Admin.create({
        name: 'Fawmond Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
      });
      console.log(`[Seed] Initial admin created: ${adminEmail}`);
    }

    // 2. Seed Cars if none exist
    const carCount = await Car.countDocuments();
    if (carCount === 0) {
      await Car.insertMany(defaultCars);
      console.log(`[Seed] Initialized ${defaultCars.length} default cars.`);
    }
  } catch (error) {
    console.error('[Seed] Error seeding data:', error.message);
  }
};

module.exports = seedData;

