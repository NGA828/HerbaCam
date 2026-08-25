import { Leaf, Brain, Heart, MapPin, Shield, BookOpen } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 pt-8">
          <h1 className="text-4xl font-bold text-stone-800 mb-4">About HerbaCam</h1>
          <p className="text-lg text-stone-500 max-w-2xl mx-auto">
            An AI-powered platform for identifying, documenting, and preserving Cameroonian traditional medicinal plant knowledge.
          </p>
        </div>

        <div className="space-y-12">
          <section className="bg-white rounded-2xl p-8 border border-stone-200">
            <h2 className="text-2xl font-bold text-stone-800 mb-4 flex items-center gap-3">
              <Brain className="w-7 h-7 text-green-600" /> Our Mission
            </h2>
            <p className="text-stone-600 leading-relaxed">
              Cameroon is home to extraordinary biodiversity and a deep tradition of medicinal plant knowledge.
              However, as communities modernize, much of this traditional knowledge risks being lost forever.
              HerbaCam bridges the gap between traditional wisdom and modern technology, using AI to help identify
              plants while creating a digital archive of traditional medicinal knowledge.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-8 border border-stone-200">
            <h2 className="text-2xl font-bold text-stone-800 mb-4 flex items-center gap-3">
              <Shield className="w-7 h-7 text-green-600" /> How It Works
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                { icon: Brain, title: 'AI Identification', desc: 'Upload plant photos for AI-assisted identification with confidence scoring.' },
                { icon: BookOpen, title: 'Knowledge Base', desc: 'Explore documented traditional uses, preparations, and regional variations.' },
                { icon: Heart, title: 'Safety First', desc: 'Evidence levels and safety information clearly separated from traditional claims.' },
                { icon: MapPin, title: 'Geographic Mapping', desc: 'Knowledge mapped across Cameroon\'s regions and communities.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-800">{item.title}</h3>
                    <p className="text-sm text-stone-500 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl p-8 border border-stone-200">
            <h2 className="text-2xl font-bold text-stone-800 mb-4 flex items-center gap-3">
              <Leaf className="w-7 h-7 text-green-600" /> Knowledge Preservation
            </h2>
            <p className="text-stone-600 leading-relaxed mb-4">
              Our preservation risk analysis system identifies traditional knowledge that may be at risk of disappearing.
              Factors include number of contributors, recency of documentation, geographic spread, and submission trends.
            </p>
            <p className="text-sm text-stone-500 italic">
              Note: The risk assessment is an analytical indicator for prioritizing documentation, not a scientific prediction
              that knowledge will disappear.
            </p>
          </section>

          <section className="bg-amber-50 rounded-2xl p-8 border border-amber-200">
            <h2 className="text-xl font-bold text-amber-800 mb-3">⚠ Important Disclaimer</h2>
            <p className="text-amber-700 leading-relaxed">
              HerbaCam is an educational and informational platform. It is NOT a replacement for professional medical
              diagnosis or treatment. Traditional knowledge is presented as documented cultural information, not as
              scientifically proven medical treatments. Always consult qualified healthcare professionals for medical
              decisions. AI identification is probabilistic and should not be considered absolute certainty.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
