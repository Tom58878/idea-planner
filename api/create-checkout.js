const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé Stripe non configurée' });
  }

  const stripe = new Stripe(apiKey);

  try {
    const { priceId, niche } = req.body || {};

    if (!priceId) {
      return res.status(400).json({ error: 'priceId requis' });
    }

    const host = req.headers.host;
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${baseUrl}?success=true&niche=${encodeURIComponent(niche || '')}`,
      cancel_url: `${baseUrl}?canceled=true`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Erreur Stripe:', error);
    return res.status(500).json({ error: error.message });
  }
};
