"""
Seed database with demo data for HerbaCam development.
All data is clearly labeled as demo/sample data.
"""
import os
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from django.utils import timezone
from django.conf import settings
from accounts.models import User
from geography.models import Region, Division, Community
from plants.models import Plant, PlantLocalName, PlantPart
from symptoms.models import Symptom
from knowledge.models import TraditionalUse, PreparationMethod
from evidence.models import Evidence
from safety.models import SafetyInformation
from articles.models import Article, ArticleCategory
from practitioners.models import PractitionerProfile


def set_plant_image(plant, image_filename):
    """Assign a pre-generated image to a plant record."""
    media_plants_dir = os.path.join(settings.MEDIA_ROOT, 'plants')
    image_path = os.path.join(media_plants_dir, image_filename)
    if os.path.exists(image_path):
        with open(image_path, 'rb') as f:
            plant.image.save(f'plants/{image_filename}', ContentFile(f.read()), save=True)
        return True
    return False


class Command(BaseCommand):
    help = 'Seed database with demo/sample data for development'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database with demo data...')

        # Create users
        admin = self._create_user('admin', 'admin@herbacam.cm', 'Admin', 'User', 'admin123!', User.Role.ADMIN)
        expert = self._create_user('drnkeng', 'expert@herbacam.cm', 'Dr. Nkeng', 'Atem', 'expert123!', User.Role.EXPERT)
        practitioner = self._create_user('mbaforc', 'practitioner@herbacam.cm', 'Mba', 'Forche', 'pract123!', User.Role.PRACTITIONER)
        user = self._create_user('demo_user', 'user@herbacam.cm', 'Demo', 'User', 'user1234!', User.Role.USER)

        # Create practitioner profiles
        PractitionerProfile.objects.get_or_create(
            user=practitioner,
            defaults={
                'community_name': 'Bamenda',
                'years_of_experience': 25,
                'areas_of_knowledge': 'Respiratory ailments, digestive health, skin conditions',
                'traditional_training': 'Learned from grandmother, traditional healer in the Northwest Region',
            }
        )

        # Create regions
        regions_data = [
            ('Centre', 'CE', 3.8667, 11.5167),
            ('Littoral', 'LT', 4.0500, 9.7000),
            ('West', 'OU', 5.4667, 10.4167),
            ('Northwest', 'NO', 6.0833, 10.2333),
            ('Southwest', 'SW', 4.2333, 9.2500),
            ('South', 'SU', 2.9333, 11.1500),
            ('East', 'ES', 4.2500, 14.7500),
            ('Adamawa', 'AD', 6.5833, 12.4333),
            ('North', 'NT', 8.5833, 13.5833),
            ('Far North', 'EN', 10.5833, 14.3167),
        ]
        regions = {}
        for name, code, lat, lon in regions_data:
            r, _ = Region.objects.get_or_create(
                name=name, defaults={'code': code, 'latitude': lat, 'longitude': lon}
            )
            regions[name] = r

        # Create preparation methods
        prep_methods = {}
        for name, desc in [
            ('DECOCTION', 'Boiling plant material in water'),
            ('INFUSION', 'Steeping plant material in hot water'),
            ('POULTICE', 'Crushed plant material applied externally'),
            ('POWDER', 'Dried and ground plant material'),
            ('JUICE', 'Fresh juice or extract from plant material'),
            ('RAW', 'Direct consumption of plant material'),
        ]:
            pm, _ = PreparationMethod.objects.get_or_create(name=name, defaults={'description': desc})
            prep_methods[name] = pm

        # Create symptoms
        symptoms_data = [
            ('Malaria', 'Febrile illness caused by Plasmodium parasites', 'Infectious'),
            ('Cough', 'Persistent cough or respiratory irritation', 'Respiratory'),
            ('Fever', 'Elevated body temperature', 'General'),
            ('Stomach ache', 'Abdominal pain or discomfort', 'Digestive'),
            ('Headache', 'Pain in the head or upper neck', 'Neurological'),
            ('Diarrhea', 'Frequent loose or liquid bowel movements', 'Digestive'),
            ('Skin rash', 'Irritation or inflammation of the skin', 'Dermatological'),
            ('Wounds', 'Cuts, abrasions, or injuries to the skin', 'Dermatological'),
            ('Hypertension', 'High blood pressure', 'Cardiovascular'),
            ('Diabetes', 'Elevated blood sugar levels', 'Metabolic'),
            ('Rheumatism', 'Joint pain and inflammation', 'Musculoskeletal'),
            ('Asthma', 'Difficulty breathing, wheezing', 'Respiratory'),
        ]
        symptoms = {}
        for name, desc, cat in symptoms_data:
            s, _ = Symptom.objects.get_or_create(name=name, defaults={'description': desc, 'category': cat})
            symptoms[name] = s

        # Create plants - DEMO DATA
        plants_data = [
            {
                'scientific_name': 'Azadirachta indica',
                'common_name': 'Neem',
                'family': 'Meliaceae',
                'genus': 'Azadirachta',
                'description': 'A fast-growing tree known for its medicinal properties. Widely cultivated in Cameroon for traditional medicine. Every part of the tree has been used in traditional healing.',
                'habitat': 'SAVANNA',
                'local_names': [('Neem', 'Hausa', 'Far North'), ('Margousier', 'French', 'Centre')],
                'regions': ['Far North', 'North', 'Adamawa'],
                'parts': ['LEAF', 'BARK', 'ROOT', 'SEED'],
            },
            {
                'scientific_name': 'Moringa oleifera',
                'common_name': 'Moringa',
                'family': 'Moringaceae',
                'genus': 'Moringa',
                'description': 'A drought-resistant tree widely cultivated for its nutritional and medicinal value. Known as the "miracle tree" for its many uses in traditional Cameroonian medicine.',
                'habitat': 'SAVANNA',
                'local_names': [('Moringa', 'Fulfulde', 'North'), ('Nébéday', 'French', 'Centre')],
                'regions': ['North', 'Far North', 'Centre', 'Adamawa'],
                'parts': ['LEAF', 'SEED', 'ROOT', 'FLOWER'],
            },
            {
                'scientific_name': 'Prunus africana',
                'common_name': 'African Cherry',
                'family': 'Rosaceae',
                'genus': 'Prunus',
                'description': 'An evergreen tree found in the montane forests of Cameroon. Its bark has been traditionally used for treating various conditions. The species is of conservation concern.',
                'habitat': 'MOUNTAIN',
                'local_names': [('Red stinkwood', 'English', 'Southwest'), ('Muéri', 'French', 'Centre')],
                'regions': ['Southwest', 'Northwest', 'West', 'South'],
                'parts': ['BARK', 'LEAF'],
            },
            {
                'scientific_name': 'Vernonia amygdalina',
                'common_name': 'Bitter Leaf',
                'family': 'Asteraceae',
                'genus': 'Vernonia',
                'description': 'A small shrub widely used in West African traditional medicine. The bitter-tasting leaves are consumed as food and used for numerous medicinal purposes in Cameroon.',
                'habitat': 'FOREST',
                'local_names': [('Ndolé', 'Duala', 'Littoral'), ('Bitter leaf', 'English', 'Northwest'), ('Feuille amère', 'French', 'Centre')],
                'regions': ['Littoral', 'Northwest', 'Southwest', 'Centre', 'West'],
                'parts': ['LEAF', 'STEM', 'ROOT'],
            },
            {
                'scientific_name': 'Cola acuminata',
                'common_name': 'Kola Nut',
                'family': 'Malvaceae',
                'genus': 'Cola',
                'description': 'An important cultural and medicinal tree in Cameroon. The kola nut has stimulant properties and plays a significant role in traditional ceremonies across many Cameroonian communities.',
                'habitat': 'FOREST',
                'local_names': [('Kola', 'Pidgin', 'Littoral'), ('Cola', 'French', 'Centre')],
                'regions': ['Littoral', 'South', 'Centre', 'East', 'Southwest'],
                'parts': ['SEED', 'BARK', 'LEAF'],
            },
            {
                'scientific_name': 'Alstonia boonei',
                'common_name': 'Stool Wood',
                'family': 'Apocynaceae',
                'genus': 'Alstonia',
                'description': 'A tall forest tree with distinctive whorled leaves. Widely used in traditional medicine across Cameroon for treating fever and malaria-related symptoms.',
                'habitat': 'FOREST',
                'local_names': [('Emien', 'Bété', 'East'), ('Godé', 'French', 'Centre')],
                'regions': ['East', 'South', 'Centre', 'Littoral'],
                'parts': ['BARK', 'LEAF', 'ROOT'],
            },
            {
                'scientific_name': 'Ocimum gratissimum',
                'common_name': 'African Basil',
                'family': 'Lamiaceae',
                'genus': 'Ocimum',
                'description': 'An aromatic herb widely grown in home gardens across Cameroon. Used both as a culinary herb and for its extensive traditional medicinal applications.',
                'habitat': 'URBAN',
                'local_names': [('Ntong', 'Ewondo', 'Centre'), ('Scent leaf', 'English', 'Northwest'), ('Basilic', 'French', 'Centre')],
                'regions': ['Centre', 'South', 'East', 'Littoral', 'Northwest'],
                'parts': ['LEAF', 'STEM', 'SEED'],
            },
            {
                'scientific_name': 'Rauvolfia vomitoria',
                'common_name': 'Poison Devil\'s Pepper',
                'family': 'Apocynaceae',
                'genus': 'Rauvolfia',
                'description': 'A shrub or small tree found in forest areas. The roots and bark are used in traditional medicine, though the plant must be prepared carefully due to its potency.',
                'habitat': 'FOREST',
                'local_names': [('Ebog', 'Bulu', 'South'), ('Rauwolfia', 'English', 'Northwest')],
                'regions': ['South', 'East', 'Centre', 'Littoral'],
                'parts': ['ROOT', 'BARK'],
            },
        ]

        plants = {}
        plant_image_map = {
            'Azadirachta indica': 'neem.jpg',
            'Moringa oleifera': 'moringa.jpg',
            'Prunus africana': 'prunus-africana.jpg',
            'Vernonia amygdalina': 'bitter-leaf.jpg',
            'Cola acuminata': 'kola-nut.jpg',
            'Alstonia boonei': 'alstonia.jpg',
            'Ocimum gratissimum': 'african-basil.jpg',
            'Rauvolfia vomitoria': 'rauvolfia.jpg',
        }
        
        for pdata in plants_data:
            plant, created = Plant.objects.get_or_create(
                scientific_name=pdata['scientific_name'],
                defaults={
                    'common_name': pdata['common_name'],
                    'family': pdata['family'],
                    'genus': pdata['genus'],
                    'description': pdata['description'],
                    'habitat': pdata['habitat'],
                }
            )
            
            # Assign image if not already set
            if not plant.image:
                image_file = plant_image_map.get(pdata['scientific_name'])
                if image_file:
                    set_plant_image(plant, image_file)
            
            if created:
                for name, lang, region_name in pdata['local_names']:
                    region = regions.get(region_name)
                    PlantLocalName.objects.create(
                        plant=plant, name=name, language=lang, region=region
                    )
                for region_name in pdata['regions']:
                    plant.regions.add(regions[region_name])
                for part in pdata['parts']:
                    PlantPart.objects.create(plant=plant, part_type=part)
            plants[pdata['scientific_name']] = plant

        # Create traditional uses (DEMO - labeled as sample)
        traditional_uses_data = [
            ('Azadirachta indica', 'Malaria', 'LEAF', 'DECOCTION', 'Northwest',
             'Bitter leaf decoction traditionally used to treat malaria symptoms in the Northwest region. Leaves are boiled and the liquid consumed.',
             'Used during rainy season when malaria is most prevalent.'),
            ('Azadirachta indica', 'Fever', 'BARK', 'DECOCTION', 'Far North',
             'Bark infusion traditionally used to reduce fever in communities of the Far North region.',
             'Often combined with other herbs in traditional practice.'),
            ('Azadirachta indica', 'Skin rash', 'LEAF', 'POULTICE', 'North',
             'Crushed fresh leaves applied as a poultice to treat skin conditions.',
             ''),
            ('Vernonia amygdalina', 'Stomach ache', 'LEAF', 'JUICE', 'Littoral',
             'Fresh leaf juice traditionally consumed to treat stomach disorders. Known locally as Ndolé, the leaves are also used as food.',
             'Central to Duala traditional medicine and cuisine.'),
            ('Vernonia amygdalina', 'Diabetes', 'LEAF', 'DECOCTION', 'Northwest',
             'Bitter leaf decoction traditionally used to help manage blood sugar levels.',
             'Regular consumption of bitter leaf soup is associated with this practice.'),
            ('Vernonia amygdalina', 'Diarrhea', 'LEAF', 'INFUSION', 'Centre',
             'Leaf infusion used traditionally to treat diarrhea in central Cameroon.',
             ''),
            ('Moringa oleifera', 'Fever', 'LEAF', 'INFUSION', 'North',
             'Moringa leaf tea traditionally used to reduce fever and boost immunity.',
             'Also used as a nutritional supplement during illness recovery.'),
            ('Moringa oleifera', 'Headache', 'LEAF', 'POWDER', 'Far North',
             'Dried leaf powder mixed with water traditionally consumed for headaches.',
             ''),
            ('Ocimum gratissimum', 'Cough', 'LEAF', 'INFUSION', 'Centre',
             'Warm leaf infusion traditionally used to relieve cough and respiratory discomfort.',
             'Often mixed with honey in traditional practice.'),
            ('Ocimum gratissimum', 'Fever', 'LEAF', 'DECOCTION', 'South',
             'Leaf decoction used in traditional fever management.',
             'The aromatic oils are believed to help reduce body temperature.'),
            ('Prunus africana', 'Hypertension', 'BARK', 'DECOCTION', 'Southwest',
             'Bark decoction traditionally used for blood pressure management in Southwest highland communities.',
             'The bark is harvested carefully due to conservation concerns.'),
            ('Prunus africana', 'Rheumatism', 'BARK', 'POWDER', 'Northwest',
             'Ground bark powder traditionally used to treat joint pain and inflammation.',
             ''),
            ('Alstonia boonei', 'Malaria', 'BARK', 'DECOCTION', 'East',
             'Bark decoction is a widely documented traditional treatment for malaria in eastern Cameroon forest communities.',
             'Considered one of the most important anti-malarial plants in the region.'),
            ('Alstonia boonei', 'Fever', 'LEAF', 'INFUSION', 'South',
             'Leaf infusion used to reduce fever in traditional practice.',
             ''),
            ('Cola acuminata', 'Headache', 'SEED', 'RAW', 'Littoral',
             'Kola nuts traditionally chewed to relieve headaches and fatigue.',
             'Kola nuts play a central role in social ceremonies and hospitality across Cameroon.'),
            ('Rauvolfia vomitoria', 'Hypertension', 'ROOT', 'DECOCTION', 'South',
             'Root decoction traditionally used for blood pressure management. Must be prepared carefully.',
             'Traditional healers emphasize careful dosing due to the plant\'s potency.'),
        ]

        for pname, sname, ptype, prep, rname, desc, context in traditional_uses_data:
            plant = plants.get(pname)
            symptom = symptoms.get(sname)
            region = regions.get(rname)
            prep_method = prep_methods.get(prep)
            part = PlantPart.objects.filter(plant=plant, part_type=ptype).first()
            
            if plant and symptom:
                TraditionalUse.objects.get_or_create(
                    plant=plant, symptom=symptom, region=region,
                    defaults={
                        'plant_part': part,
                        'preparation': prep_method,
                        'description': desc,
                        'cultural_context': context,
                        'is_verified': True,
                        'source': f'Sample data - contributed by demo practitioner',
                        'contributor': practitioner,
                        'verified_by': expert,
                    }
                )

        # Create evidence records (DEMO - clearly labeled)
        evidence_data = [
            ('Azadirachta indica', 'MODERATE', 'Multiple studies have investigated anti-malarial properties of neem extracts. Some in-vitro studies show promising results against Plasmodium.', 'Journal of Ethnopharmacology - DEMO REFERENCE'),
            ('Vernonia amygdalina', 'MODERATE', 'Research suggests potential hypoglycemic effects in animal models. Traditional use well-documented across West Africa.', 'African Journal of Traditional Medicine - DEMO REFERENCE'),
            ('Prunus africana', 'PRELIMINARY', 'Some studies suggest bark extracts may have anti-inflammatory properties. Conservation status makes research limited.', 'Conservation Biology - DEMO REFERENCE'),
            ('Moringa oleifera', 'MODERATE', 'Nutritional properties well-documented. Some preliminary evidence for antioxidant and anti-inflammatory effects.', 'Phytotherapy Research - DEMO REFERENCE'),
        ]
        for pname, level, summary, source in evidence_data:
            plant = plants.get(pname)
            if plant:
                Evidence.objects.get_or_create(
                    plant=plant, source=source,
                    defaults={
                        'level': level,
                        'summary': summary,
                        'reviewer': expert,
                    }
                )

        # Create safety records (DEMO)
        safety_data = [
            ('Azadirachta indica', 'MODERATE', True, False, 'Avoid during pregnancy. High doses may be toxic.', ''),
            ('Vernonia amygdalina', 'LOW', False, False, 'Generally safe in food amounts. Bitter taste may cause nausea in some.', ''),
            ('Prunus africana', 'MODERATE', True, True, 'Not recommended during pregnancy. Do not exceed traditional doses.', 'Sustainable harvesting is critical.'),
            ('Rauvolfia vomitoria', 'HIGH', True, True, 'This plant is potent and must be used with extreme caution. Only under guidance of experienced practitioners.', 'Contains reserpine-like compounds.'),
            ('Moringa oleifera', 'LOW', False, False, 'Generally safe. Root should be avoided during pregnancy.', ''),
        ]
        for pname, risk, preg, child, prec, concerns in safety_data:
            plant = plants.get(pname)
            if plant:
                SafetyInformation.objects.get_or_create(
                    plant=plant,
                    defaults={
                        'risk_level': risk,
                        'pregnancy_warning': preg,
                        'children_warning': child,
                        'precautions': prec,
                        'preparation_concerns': concerns,
                        'general_warning': 'This is DEMO data for educational purposes. Always consult healthcare professionals.',
                        'reviewer': expert,
                        'is_verified': True,
                    }
                )

        # Create article categories and articles
        cat, _ = ArticleCategory.objects.get_or_create(
            slug='traditional-medicine', defaults={'name': 'Traditional Medicine', 'description': 'Articles about traditional healing practices'}
        )
        cat2, _ = ArticleCategory.objects.get_or_create(
            slug='plant-profiles', defaults={'name': 'Plant Profiles', 'description': 'Detailed profiles of medicinal plants'}
        )
        cat3, _ = ArticleCategory.objects.get_or_create(
            slug='conservation', defaults={'name': 'Conservation', 'description': 'Knowledge preservation and conservation'}
        )

        articles_data = [
            ('Understanding Traditional Medicine in Cameroon', 'understanding-traditional-medicine', cat,
             'An overview of the rich tradition of medicinal plant knowledge across Cameroon\'s diverse regions.',
             'Cameroon is home to extraordinary biodiversity and a deep tradition of medicinal plant knowledge passed down through generations. This article explores how traditional healers across the country\'s ten regions have developed sophisticated practices...\n\n## The Diversity of Traditional Knowledge\n\nFrom the Sahelian north to the coastal south, each region has developed unique approaches to plant-based medicine...\n\n## Why Documentation Matters\n\nAs communities modernize, some traditional knowledge risks being lost. Digital preservation helps ensure this heritage survives for future generations.\n\n*Note: This is sample content for demonstration purposes.*'),
            ('The Role of Evidence in Traditional Medicine', 'role-of-evidence', cat,
             'How scientific evidence relates to traditional claims about medicinal plants.',
             'Traditional medicine has been practiced for millennia, but modern science approaches plant-based treatments differently. Understanding the relationship between traditional claims and scientific evidence is crucial...\n\n## Evidence Levels\n\nWe categorize evidence from Insufficient to Strong, helping users understand the current state of scientific knowledge...\n\n*Note: This is sample content for demonstration purposes.*'),
            ('Bitter Leaf (Vernonia amygdalina): A Cameroonian Treasure', 'bitter-leaf-profile', cat2,
             'Exploring the many uses of one of Cameroon\'s most important medicinal plants.',
             'Known as "Ndolé" in the Duala language, bitter leaf is arguably the most widely used medicinal plant in Cameroon...\n\n*Note: This is sample content for demonstration purposes.*'),
            ('Preserving Knowledge Before It Disappears', 'preserving-knowledge', cat3,
             'Why documenting traditional plant knowledge is urgent.',
             'Every year, traditional healers pass away taking decades of knowledge with them. HerbaCam\'s risk assessment system helps identify which knowledge areas need urgent documentation...\n\n*Note: This is sample content for demonstration purposes.*'),
        ]

        for title, slug, category, summary, content in articles_data:
            Article.objects.get_or_create(
                slug=slug,
                defaults={
                    'title': title,
                    'category': category,
                    'summary': summary,
                    'content': content,
                    'author': admin,
                    'is_published': True,
                    'published_at': timezone.now(),
                }
            )

        self.stdout.write(self.style.SUCCESS('Demo data seeded successfully!'))
        self.stdout.write(f'  Users: admin/admin123!, drnkeng/expert123!, mbaforc/pract123!, demo_user/user1234!')
        self.stdout.write(f'  Plants: {Plant.objects.count()}')
        self.stdout.write(f'  Symptoms: {Symptom.objects.count()}')
        self.stdout.write(f'  Traditional uses: {TraditionalUse.objects.count()}')
        self.stdout.write(f'  Articles: {Article.objects.count()}')
        self.stdout.write(self.style.WARNING('  ⚠ All data is DEMO/SAMPLE data for development purposes.'))

    def _create_user(self, username, email, first, last, password, role):
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': email, 'first_name': first, 'last_name': last,
                'role': role, 'is_staff': role == User.Role.ADMIN,
                'is_superuser': role == User.Role.ADMIN,
            }
        )
        if created:
            user.set_password(password)
            user.save()
        return user
