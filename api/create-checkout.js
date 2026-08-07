const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);    

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { priceId, niche } = JSON.parse(event.body);

    const siteUrl = event.headers.origin || event.headers.referer || 'https://bespoke-kleicha-6d708d.netlify.app';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${siteUrl}/?success=true&niche=${encodeURIComponent(niche || '')}`,
      cancel_url: `${siteUrl}/?canceled=true`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    return { 
      statusCode: 500, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }) 
    };
  }
};
