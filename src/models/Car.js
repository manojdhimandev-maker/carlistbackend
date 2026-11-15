const mongoose = require('mongoose');

const carSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    make: {
      type: String,
      required: [true, 'Make is required'],
      trim: true,
      maxlength: 50,
      index: true,
    },
    model: {
      type: String,
      required: [true, 'Model is required'],
      trim: true,
      maxlength: 100,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: 1900,
      max: 2035,
      index: true,
    },
    mileage: {
      type: Number,
      required: [true, 'Mileage is required'],
      min: 0,
      index: true,
    },
    transmission: {
      type: String,
      enum: ['Automatic', 'Manual'],
      default: 'Automatic',
    },
    fuel: {
      type: String,
      enum: ['Petrol', 'Diesel', 'Hybrid', 'Electric'],
      required: [true, 'Fuel type is required'],
      index: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
      index: true,
    },
    image: {
      type: String,
      required: [true, 'Primary image is required'],
    },
    images: {
      type: [String],
      default: function () {
        return this.image ? [this.image] : [];
      },
    },
    body: {
      type: String,
      enum: ['Saloon', 'Estate', 'SUV', 'Hatchback', 'Coupe', 'Convertible'],
      default: 'Saloon',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    engine: {
      type: String,
      default: '',
    },
    colour: {
      type: String,
      default: '',
    },
    registration: {
      type: String,
      default: '',
    },
    specifications: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for id to match frontend expectation (slug or _id)
carSchema.virtual('id').get(function () {
  return this.slug || this._id.toString();
});

// Auto-generate slug before saving if not provided
carSchema.pre('save', function () {
  if (!this.slug) {
    const base = `${this.make}-${this.model}-${this.year}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    this.slug = `${base}-${Date.now().toString(36)}`;
  }
  if (!this.images || this.images.length === 0) {
    if (this.image) this.images = [this.image];
  }
});

module.exports = mongoose.model('Car', carSchema);
