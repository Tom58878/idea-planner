const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Tes deux vrais identifiants Stripe sécurisés :
const STRIPE_PRICES = {
  starter: 'price_1UCONMAIBTzQkQu5jEsqw0gd',
  pro: 'price_1UCOO3AIBTzQkQu5sMpQCNXd'
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { packType, niche, count, platforms, tone, objective } = req.body || {};
    
    // On récupère automatiquement le bon code Stripe selon que c'est 'starter' ou 'pro'
    const priceId = STRIPE_PRICES[packType];
    if (!priceId) {
      return res.status(400).json({ error: 'Pack invalide ou non spécifié.' });
    }

    const siteUrl = req.headers.origin || req.headers.referer || `https://${req.headers.host}`;

    const returnParams = new URLSearchParams({
      success: 'true',
      niche: niche || '',
      count: count || '5',
      platforms: (platforms || []).join(','),
      tone: tone || '',
      objective: objective || 'balanced'
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${siteUrl}/?${returnParams.toString()}`,
      cancel_url: `${siteUrl}/?canceled=true`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports.config = { maxDuration: 30 };
