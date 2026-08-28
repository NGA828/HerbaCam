"""
Seed database with demo data for HerbaCam development.

The dataset is deliberately large enough to exercise every screen of the
application: public discovery, AI identification history, the practitioner
contribution workflow, expert review, evidence/safety curation, preservation
risk and the admin audit trail.

All data is clearly labeled as demo/sample data and must never be treated as
medical advice.

Usage:
    python manage.py seed_data            # add demo data (idempotent)
    python manage.py seed_data --clear    # wipe demo records first, then seed
"""
import os
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from django.db.models import Q
from django.utils import timezone
from django.conf import settings

from accounts.models import User, SystemSetting
from geography.models import Region, Division, Subdivision, Community
from plants.models import Plant, PlantLocalName, PlantPart
from symptoms.models import Symptom
from knowledge.models import TraditionalUse, PreparationMethod, KnowledgeSubmission
from evidence.models import Evidence
from safety.models import SafetyInformation
from articles.models import Article, ArticleCategory
from practitioners.models import PractitionerProfile
from identification.models import Identification, IdentificationResult
from analytics.models import Favorite
from notifications.models import Notification
from preservation.models import RiskAssessment
from audit.models import AuditLog

SEED_IMAGE_DIRS = [
    os.path.join(settings.MEDIA_ROOT, 'plants'),
    os.path.join(settings.BASE_DIR.parent, 'frontend', 'src', 'assets', 'plants'),
]

# Botanical artwork shipped with the frontend. Reused cyclically so every
# demo plant has a real image to render instead of a broken <img>.
PLANT_ARTWORK = [
    'african-basil.jpg',
    'alstonia.jpg',
    'bitter-leaf.jpg',
    'kola-nut.jpg',
    'moringa.jpg',
    'neem.jpg',
    'prunus-africana.jpg',
    'rauvolfia.jpg',
]

RANDOM = random.Random(20260828)  # deterministic demo data


def set_plant_image(plant, image_filename):
    """Assign a pre-generated image to a plant record."""
    for source_dir in SEED_IMAGE_DIRS:
        image_path = os.path.join(source_dir, image_filename)
        if os.path.exists(image_path):
            with open(image_path, 'rb') as f:
                plant.image.save(image_filename, ContentFile(f.read()), save=True)
            return True
    return False


def read_artwork(image_filename):
    """Return the raw bytes of a shipped botanical artwork, or None."""
    for source_dir in SEED_IMAGE_DIRS:
        image_path = os.path.join(source_dir, image_filename)
        if os.path.exists(image_path):
            with open(image_path, 'rb') as f:
                return f.read()
    return None


def plant_image_missing(plant):
    """True when the plant has no image or its file is absent from storage."""
    if not plant.image:
        return True
    try:
        return not plant.image.storage.exists(plant.image.name)
    except (NotImplementedError, ValueError):
        return False


class Command(BaseCommand):
    help = 'Seed database with demo/sample data for development'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete existing demo records (everything except nothing) before seeding.',
        )

    # ------------------------------------------------------------------ utils

    def _stamp(self, obj, field, when):
        """Force a timestamp on an auto_now_add field while preserving order."""
        setattr(obj, field, when)
        obj.__class__.objects.filter(pk=obj.pk).update(**{field: when})

    def _log(self, user, action, description, target_type='', target_id=None, when=None):
        entry = AuditLog.objects.create(
            user=user, action=action, description=description,
            target_type=target_type, target_id=target_id,
        )
        if when:
            self._stamp(entry, 'created_at', when)
        return entry

    def _clear(self):
        self.stdout.write('Clearing existing demo records…')
        RiskAssessment.objects.all().delete()
        Favorite.objects.all().delete()
        Notification.objects.all().delete()
        Identification.objects.all().delete()
        KnowledgeSubmission.objects.all().delete()
        TraditionalUse.objects.all().delete()
        Evidence.objects.all().delete()
        SafetyInformation.objects.all().delete()
        Plant.objects.all().delete()
        Symptom.objects.all().delete()
        Article.objects.all().delete()
        ArticleCategory.objects.all().delete()
        Community.objects.all().delete()
        Subdivision.objects.all().delete()
        Division.objects.all().delete()
        Region.objects.all().delete()
        PreparationMethod.objects.all().delete()
        PractitionerProfile.objects.all().delete()
        SystemSetting.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()
        User.objects.filter(is_superuser=True).delete()
        AuditLog.objects.all().delete()

    # ------------------------------------------------------------------ users

    USERS = [
        # username, email, first, last, password, role, phone, bio
        ('admin', 'admin@herbacam.cm', 'Admin', 'User', 'admin123!', User.Role.ADMIN,
         '+237 677 000 001', 'Platform administrator responsible for curation and moderation.'),
        ('nadege', 'nadege@herbacam.cm', 'Nadege', 'Kamdem', 'admin123!', User.Role.ADMIN,
         '+237 677 000 002', 'Co-administrator focused on practitioner onboarding in the West region.'),

        ('drnkeng', 'expert@herbacam.cm', 'Dr. Nkeng', 'Atem', 'expert123!', User.Role.EXPERT,
         '+237 699 100 010', 'Ethnobotanist reviewing knowledge submissions and evidence records.'),
        ('dretoundi', 'etoundi@herbacam.cm', 'Dr. Etoundi', 'Manga', 'expert123!', User.Role.EXPERT,
         '+237 699 100 011', 'Pharmacognosy researcher interested in anti-malarial plant extracts.'),
        ('profeyong', 'eyong@herbacam.cm', 'Prof. Eyong', 'Clara', 'expert123!', User.Role.EXPERT,
         '+237 699 100 012', 'Public health researcher working on safety documentation standards.'),

        ('mbaforc', 'practitioner@herbacam.cm', 'Mba', 'Forche', 'pract123!', User.Role.PRACTITIONER,
         '+237 655 200 010', 'Third-generation healer documenting Northwest highland remedies.'),
        ('talla_e', 'talla@herbacam.cm', 'Talla', 'Emmanuel', 'pract123!', User.Role.PRACTITIONER,
         '+237 655 200 011', 'Specialist in bark and root preparations for respiratory complaints.'),
        ('njikam_a', 'njikam@herbacam.cm', 'Njikam', 'Amina', 'pract123!', User.Role.PRACTITIONER,
         '+237 655 200 012', 'Women\'s health practitioner from the Adamawa plateau.'),
        ('awah_p', 'awah@herbacam.cm', 'Awah', 'Peter', 'pract123!', User.Role.PRACTITIONER,
         '+237 655 200 013', 'Documents wound-healing and skin remedies of the Southwest coast.'),
        ('bongfen_r', 'bongfen@herbacam.cm', 'Bongfen', 'Rose', 'pract123!', User.Role.PRACTITIONER,
         '+237 655 200 014', 'Community healer and midwife from the East forest region.'),

        ('demo_user', 'user@herbacam.cm', 'Demo', 'User', 'user1234!', User.Role.USER,
         '+237 690 300 010', 'Curious learner exploring Cameroonian medicinal plants.'),
        ('ajara_m', 'ajara@herbacam.cm', 'Ajara', 'Musa', 'user1234!', User.Role.USER,
         '+237 690 300 011', 'Smallholder farmer interested in home-garden remedies.'),
        ('chantal_n', 'chantal@herbacam.cm', 'Chantal', 'Ngando', 'user1234!', User.Role.USER,
         '+237 690 300 012', 'Nursing student documenting family remedies from the Centre region.'),
        ('essomba_p', 'essomba@herbacam.cm', 'Essomba', 'Pierre', 'user1234!', User.Role.USER,
         '+237 690 300 013', 'Teacher and amateur botanist based in Yaounde.'),
        ('fonkwa_l', 'fonkwa@herbacam.cm', 'Fonkwa', 'Linda', 'user1234!', User.Role.USER,
         '+237 690 300 014', 'Interested in nutrition and food-medicine overlaps.'),
        ('moukoko_j', 'moukoko@herbacam.cm', 'Moukoko', 'Joseph', 'user1234!', User.Role.USER,
         '+237 690 300 015', 'Herbal tea entrepreneur sourcing plants in the Littoral region.'),
    ]

    def _users(self):
        users = {}
        now = timezone.now()
        for index, (username, email, first, last, password, role, phone, bio) in enumerate(self.USERS):
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email, 'first_name': first, 'last_name': last,
                    'role': role, 'phone': phone, 'bio': bio,
                    'is_staff': role == User.Role.ADMIN,
                    'is_superuser': role == User.Role.ADMIN,
                },
            )
            if created:
                user.set_password(password)
                user.date_joined = now - timedelta(days=420 - index * 18)
                user.save()
            users[username] = user
        return users

    # -------------------------------------------------------------- geography

    REGIONS = [
        ('Centre', 'CE', 3.8667, 11.5167,
         'Forest-savanna mosaic around Yaounde. Strong Ewondo and Bassa herbal traditions.'),
        ('Littoral', 'LT', 4.0500, 9.7000,
         'Coastal mangroves and the Douala basin, a crossroads of Duala and Bakoko plant knowledge.'),
        ('West', 'OU', 5.4667, 10.4167,
         'Bamileke highlands with dense settlement and a long tradition of home-garden medicine.'),
        ('Northwest', 'NO', 6.0833, 10.2333,
         'Volcanic highlands and montane forest; home of Prunus africana harvesting communities.'),
        ('Southwest', 'SW', 4.2333, 9.2500,
         'Montane forests around Mount Cameroon with exceptionally high plant endemism.'),
        ('South', 'SU', 2.9333, 11.1500,
         'Equatorial rainforest with Bulu and Fang communities and deep forest pharmacopoeia.'),
        ('East', 'ES', 4.2500, 14.7500,
         'Sparsely populated forest region where documentation pressure is highest.'),
        ('Adamawa', 'AD', 6.5833, 12.4333,
         'High plateau of Fulfulde pastoralists blending Sahelian and forest plant knowledge.'),
        ('North', 'NT', 8.5833, 13.5833,
         'Sudano-Sahelian savanna with a strong Hausa and Gbaya medicinal tradition.'),
        ('Far North', 'EN', 10.5833, 14.3167,
         'Sahelian zone and the Logone floodplain, where drought-tolerant species dominate.'),
    ]

    DIVISIONS = {
        'Centre': ['Mfoundi', 'Nyong-et-Kelle', 'Lekie', 'Mefou-et-Afamba'],
        'Littoral': ['Wouri', 'Moungo', 'Nkam', 'Sanaga-Maritime'],
        'West': ['Mifi', 'Ndé', 'Menoua', 'Koung-Khi'],
        'Northwest': ['Mezam', 'Menchum', 'Bui', 'Donga-Mantung'],
        'Southwest': ['Fako', 'Manyu', 'Meme', 'Kupe-Manengouba'],
        'South': ['Dja-et-Lobo', 'Mvila', 'Océan', 'Vallée-du-Ntem'],
        'East': ['Boumba-et-Ngoko', 'Haut-Nyong', 'Kadey', 'Lom-et-Djérem'],
        'Adamawa': ['Vina', 'Faro-et-Déo', 'Mayo-Banyo', 'Mbere'],
        'North': ['Bénoué', 'Mayo-Rey', 'Mayo-Louti', 'Faro'],
        'Far North': ['Diamaré', 'Mayo-Sava', 'Logone-et-Chari', 'Mayo-Tsanaga'],
    }

    COMMUNITIES = {
        'Centre': ['Yaoundé III', 'Okola', 'Sa\'a', 'Obala', 'Mbalmayo'],
        'Littoral': ['Bonamoussadi', 'Nkongsamba', 'Yabassi', 'Pouma', 'Penja'],
        'West': ['Bafoussam II', 'Bandjoun', 'Dschang', 'Bangangté', 'Foumban'],
        'Northwest': ['Bambui', 'Wum', 'Kumbo', 'Nkambe', 'Bali'],
        'Southwest': ['Buea Town', 'Mamfe', 'Kumba', 'Bangem', 'Tiko'],
        'South': ['Sangmélima', 'Ebolowa', 'Kribi', 'Ambam', 'Djoum'],
        'East': ['Yokadouma', 'Abong-Mbang', 'Batouri', 'Bertoua', 'Garoua-Boulaï'],
        'Adamawa': ['Ngaoundéré II', 'Tignère', 'Banyo', 'Meiganga', 'Ngaoundal'],
        'North': ['Garoua II', 'Tcholliré', 'Guider', 'Pitoa', 'Poli'],
        'Far North': ['Maroua II', 'Mora', 'Kousseri', 'Kaélé', 'Mokolo'],
    }

    def _geography(self):
        regions, divisions, communities = {}, {}, {}
        for name, code, lat, lon, description in self.REGIONS:
            region, _ = Region.objects.get_or_create(
                name=name,
                defaults={'code': code, 'latitude': lat, 'longitude': lon, 'description': description},
            )
            regions[name] = region

        for region_name, names in self.DIVISIONS.items():
            region = regions[region_name]
            for division_name in names:
                division, _ = Division.objects.get_or_create(
                    name=division_name, region=region,
                    defaults={'description': f'{division_name} division, {region.name} region.'},
                )
                divisions[division_name] = division
                subdivision, _ = Subdivision.objects.get_or_create(
                    name=f'{division_name} Central', division=division,
                    defaults={'description': f'Central subdivision of {division_name}.'},
                )
                for community_name in RANDOM.sample(
                    self.COMMUNITIES[region_name], k=min(3, len(self.COMMUNITIES[region_name]))
                ):
                    community, _ = Community.objects.get_or_create(
                        name=f'{community_name} ({division_name})',
                        region=region,
                        defaults={'subdivision': subdivision,
                                  'description': f'{community_name} community in {division_name} division.'},
                    )
                    communities[f'{community_name} ({division_name})'] = community
        return regions, divisions, communities

    # ---------------------------------------------------------------- symptoms

    SYMPTOMS = [
        ('Malaria', 'Febrile illness caused by Plasmodium parasites transmitted by mosquitoes.', 'Infectious'),
        ('Cough', 'Persistent cough or respiratory irritation.', 'Respiratory'),
        ('Fever', 'Elevated body temperature, often with chills and sweating.', 'General'),
        ('Stomach ache', 'Abdominal pain or discomfort.', 'Digestive'),
        ('Headache', 'Pain in the head or upper neck.', 'Neurological'),
        ('Diarrhea', 'Frequent loose or liquid bowel movements.', 'Digestive'),
        ('Skin rash', 'Irritation or inflammation of the skin.', 'Dermatological'),
        ('Wounds', 'Cuts, abrasions, or injuries to the skin.', 'Dermatological'),
        ('Hypertension', 'Persistently elevated blood pressure.', 'Cardiovascular'),
        ('Diabetes', 'Elevated blood sugar levels.', 'Metabolic'),
        ('Rheumatism', 'Joint pain and inflammation.', 'Musculoskeletal'),
        ('Asthma', 'Difficulty breathing with wheezing.', 'Respiratory'),
        ('Toothache', 'Pain in or around a tooth.', 'Oral health'),
        ('Typhoid fever', 'Systemic bacterial infection with prolonged fever.', 'Infectious'),
        ('Jaundice', 'Yellowing of the skin and eyes.', 'Hepatic'),
        ('Dysentery', 'Inflammation of the intestine with blood in stool.', 'Digestive'),
        ('Constipation', 'Infrequent or difficult bowel movements.', 'Digestive'),
        ('Insomnia', 'Difficulty falling or staying asleep.', 'Neurological'),
        ('Menstrual pain', 'Painful cramps during menstruation.', 'Women’s health'),
        ('Eye infection', 'Redness, discharge, or irritation of the eye.', 'Sensory'),
        ('Ear infection', 'Pain and inflammation of the ear canal.', 'Sensory'),
        ('Burns', 'Thermal injury to the skin.', 'Dermatological'),
        ('Snake bite', 'Envenomation following a snake bite.', 'Emergency'),
        ('Measles', 'Viral illness with fever and rash.', 'Infectious'),
        ('Intestinal worms', 'Parasitic infection of the digestive tract.', 'Infectious'),
        ('Fatigue', 'Persistent tiredness and low energy.', 'General'),
        ('Loss of appetite', 'Reduced desire to eat.', 'General'),
        ('Arthritis', 'Chronic inflammation of the joints.', 'Musculoskeletal'),
        ('Ulcers', 'Open sores in the stomach lining or on the skin.', 'Digestive'),
        ('Anaemia', 'Low red blood cell count causing weakness.', 'Blood'),
        ('Prostate complaints', 'Urinary difficulty in men.', 'Men’s health'),
        ('Nausea', 'Sensation of needing to vomit.', 'Digestive'),
    ]

    def _symptoms(self):
        symptoms = {}
        for name, description, category in self.SYMPTOMS:
            symptom, _ = Symptom.objects.get_or_create(
                name=name, defaults={'description': description, 'category': category}
            )
            symptoms[name] = symptom
        return symptoms

    # ------------------------------------------------------------------ plants

    PLANTS = [
        {
            'scientific_name': 'Azadirachta indica',
            'common_name': 'Neem',
            'family': 'Meliaceae',
            'genus': 'Azadirachta',
            'description': 'A fast-growing evergreen tree cultivated across the Sahel and savanna belt of Cameroon. Nearly every part of the tree — leaf, bark, seed and root — appears in traditional preparations, and it is one of the most frequently cited anti-malarial plants in northern Cameroon.',
            'habitat': 'SAVANNA',
            'local_names': [('Neem', 'Hausa', 'Far North'), ('Margousier', 'French', 'Centre'), ('Dogon yaro', 'Fulfulde', 'North')],
            'regions': ['Far North', 'North', 'Adamawa', 'Centre'],
            'parts': ['LEAF', 'BARK', 'ROOT', 'SEED'],
        },
        {
            'scientific_name': 'Moringa oleifera',
            'common_name': 'Moringa',
            'family': 'Moringaceae',
            'genus': 'Moringa',
            'description': 'A drought-resistant tree grown in compound gardens for food and medicine. Leaves are dried and powdered as a nutritional supplement, while seeds, roots and flowers all have documented traditional uses in northern Cameroon.',
            'habitat': 'SAVANNA',
            'local_names': [('Zogallé', 'Hausa', 'North'), ('Nébéday', 'French', 'Centre'), ('Moringa', 'Fulfulde', 'Adamawa')],
            'regions': ['North', 'Far North', 'Centre', 'Adamawa'],
            'parts': ['LEAF', 'SEED', 'ROOT', 'FLOWER'],
        },
        {
            'scientific_name': 'Prunus africana',
            'common_name': 'African Cherry',
            'family': 'Rosaceae',
            'genus': 'Prunus',
            'description': 'An evergreen montane tree whose bark has been harvested for generations across the Cameroonian highlands. Unsustainable bark harvesting has made the species a conservation priority on Mount Cameroon and the Bamenda highlands.',
            'habitat': 'MOUNTAIN',
            'local_names': [('Red stinkwood', 'English', 'Southwest'), ('Muéri', 'French', 'Centre'), ('Kanda', 'Bakossi', 'Southwest')],
            'regions': ['Southwest', 'Northwest', 'West', 'South'],
            'parts': ['BARK', 'LEAF'],
        },
        {
            'scientific_name': 'Vernonia amygdalina',
            'common_name': 'Bitter Leaf',
            'family': 'Asteraceae',
            'genus': 'Vernonia',
            'description': 'A shrub cultivated in nearly every compound in the forest zone. The intensely bitter leaves are eaten as a vegetable (ndolé) and used medicinally, making it arguably the most widely known medicinal plant in Cameroon.',
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
            'description': 'A culturally central forest tree whose caffeine-rich seeds are chewed as a stimulant and presented in ceremonies. Beyond its social role, kola appears in remedies for fatigue, headache and appetite loss.',
            'habitat': 'FOREST',
            'local_names': [('Kola', 'Pidgin', 'Littoral'), ('Cola', 'French', 'Centre'), ('Ebong', 'Ewondo', 'Centre')],
            'regions': ['Littoral', 'South', 'Centre', 'East', 'Southwest'],
            'parts': ['SEED', 'BARK', 'LEAF'],
        },
        {
            'scientific_name': 'Alstonia boonei',
            'common_name': 'Stool Wood',
            'family': 'Apocynaceae',
            'genus': 'Alstonia',
            'description': 'A tall forest tree with whorled leaves and a soft, pale wood. Its bark decoction is among the most frequently documented traditional anti-malarial preparations in the Congo basin forest zone.',
            'habitat': 'FOREST',
            'local_names': [('Emien', 'Bété', 'East'), ('Godé', 'French', 'Centre'), ('Bokuka', 'Duala', 'Littoral')],
            'regions': ['East', 'South', 'Centre', 'Littoral'],
            'parts': ['BARK', 'LEAF', 'ROOT'],
        },
        {
            'scientific_name': 'Ocimum gratissimum',
            'common_name': 'African Basil',
            'family': 'Lamiaceae',
            'genus': 'Ocimum',
            'description': 'An aromatic shrub grown beside kitchen doors throughout Cameroon. It is both a culinary herb and one of the most commonly used household remedies for digestive complaints and fever.',
            'habitat': 'URBAN',
            'local_names': [('Ntong', 'Ewondo', 'Centre'), ('Scent leaf', 'English', 'Southwest'), ('Mfouh', 'Bamileke', 'West')],
            'regions': ['Centre', 'Littoral', 'West', 'Southwest', 'Northwest'],
            'parts': ['LEAF', 'STEM', 'FLOWER'],
        },
        {
            'scientific_name': 'Rauvolfia vomitoria',
            'common_name': 'Poison Devil’s Pepper',
            'family': 'Apocynaceae',
            'genus': 'Rauvolfia',
            'description': 'A forest shrub whose root and bark contain potent reserpine-like alkaloids. Traditional healers use it with great caution, and it is the species most often cited in practitioner warnings about dosing.',
            'habitat': 'FOREST',
            'local_names': [('Akon afia', 'Efik', 'Southwest'), ('Poison devil', 'English', 'South'), ('Nkui', 'Bamileke', 'West')],
            'regions': ['South', 'Centre', 'Littoral', 'East'],
            'parts': ['ROOT', 'BARK', 'LEAF'],
        },
        {
            'scientific_name': 'Zingiber officinale',
            'common_name': 'Ginger',
            'family': 'Zingiberaceae',
            'genus': 'Zingiber',
            'description': 'A rhizomatous herb traded across Cameroon for both cooking and medicine. Fresh or dried rhizome infusions are among the most widely used household preparations for nausea and cold symptoms.',
            'habitat': 'URBAN',
            'local_names': [('Gingembre', 'French', 'Centre'), ('Tsugun tsuntsu', 'Hausa', 'North'), ('Ngnionso', 'Bamileke', 'West')],
            'regions': ['North', 'Far North', 'Adamawa', 'Centre', 'West'],
            'parts': ['TUBER', 'ROOT'],
        },
        {
            'scientific_name': 'Curcuma longa',
            'common_name': 'Turmeric',
            'family': 'Zingiberaceae',
            'genus': 'Curcuma',
            'description': 'A rhizome crop with a deep orange interior, increasingly grown in Cameroonian home gardens. It is used in warming preparations and as a colouring and preserving agent in traditional mixtures.',
            'habitat': 'URBAN',
            'local_names': [('Safran des Indes', 'French', 'Centre'), ('Kurkum', 'Hausa', 'North')],
            'regions': ['Centre', 'Littoral', 'North'],
            'parts': ['TUBER'],
        },
        {
            'scientific_name': 'Allium sativum',
            'common_name': 'Garlic',
            'family': 'Amaryllidaceae',
            'genus': 'Allium',
            'description': 'A widely cultivated bulb used across Cameroon as a food Preservative and household remedy. Crushed cloves are macerated in water or honey for respiratory and cardiovascular complaints.',
            'habitat': 'URBAN',
            'local_names': [('Ail', 'French', 'Centre'), ('Tafarnuwa', 'Hausa', 'Far North')],
            'regions': ['North', 'Far North', 'Adamawa', 'Centre'],
            'parts': ['TUBER', 'WHOLE'],
        },
        {
            'scientific_name': 'Aloe vera',
            'common_name': 'Aloe',
            'family': 'Asphodelaceae',
            'genus': 'Aloe',
            'description': 'A succulent grown in pots and garden edges throughout Cameroon. The leaf gel is applied directly to burns and skin irritations, making it one of the most widely recognized first-aid plants.',
            'habitat': 'SAVANNA',
            'local_names': [('Aloès', 'French', 'Centre'), ('Mintamba', 'Ewondo', 'Centre')],
            'regions': ['Centre', 'North', 'Adamawa', 'West'],
            'parts': ['LEAF', 'SAP'],
        },
        {
            'scientific_name': 'Carica papaya',
            'common_name': 'Papaya',
            'family': 'Caricaceae',
            'genus': 'Carica',
            'description': 'A fast-growing fruit tree found in nearly every Cameroonian compound. Leaves, seeds, unripe fruit and roots all appear in traditional preparations, especially for digestive complaints.',
            'habitat': 'URBAN',
            'local_names': [('Papaie', 'French', 'Centre'), ('Gwanda', 'Hausa', 'North'), ('Mango mbongo', 'Duala', 'Littoral')],
            'regions': ['Centre', 'Littoral', 'West', 'South', 'East'],
            'parts': ['LEAF', 'FRUIT', 'SEED', 'ROOT'],
        },
        {
            'scientific_name': 'Mangifera indica',
            'common_name': 'Mango',
            'family': 'Anacardiaceae',
            'genus': 'Mangifera',
            'description': 'A large fruit tree naturalized throughout the savanna and forest margins. The bark and leaves are used in preparations for fever, diarrhea and oral hygiene.',
            'habitat': 'SAVANNA',
            'local_names': [('Mangue', 'French', 'Centre'), ('Mangoro', 'Duala', 'Littoral'), ('Mangwaro', 'Hausa', 'North')],
            'regions': ['Centre', 'West', 'North', 'Adamawa'],
            'parts': ['BARK', 'LEAF', 'SEED'],
        },
        {
            'scientific_name': 'Psidium guajava',
            'common_name': 'Guava',
            'family': 'Myrtaceae',
            'genus': 'Psidium',
            'description': 'A small fruit tree common in village gardens. Young leaf and bark decoctions are among the most frequently used traditional preparations for diarrhea across Cameroon.',
            'habitat': 'URBAN',
            'local_names': [('Goyave', 'French', 'Centre'), ('Gwaba', 'Hausa', 'North')],
            'regions': ['Centre', 'Littoral', 'West', 'North'],
            'parts': ['LEAF', 'BARK', 'FRUIT'],
        },
        {
            'scientific_name': 'Cymbopogon citratus',
            'common_name': 'Lemongrass',
            'family': 'Poaceae',
            'genus': 'Cymbopogon',
            'description': 'A clump-forming grass cultivated along garden boundaries. Its lemon-scented leaves are steeped into a common household tea for fever and mild digestive upset.',
            'habitat': 'SAVANNA',
            'local_names': [('Citronnelle', 'French', 'Centre'), ('Tsaida', 'Hausa', 'North'), ('Nkang', 'Bamileke', 'West')],
            'regions': ['Centre', 'West', 'Northwest', 'North'],
            'parts': ['LEAF', 'STEM'],
        },
        {
            'scientific_name': 'Khaya senegalensis',
            'common_name': 'African Mahogany',
            'family': 'Meliaceae',
            'genus': 'Khaya',
            'description': 'A large savanna timber tree whose bitter bark is widely traded in northern Cameroonian markets. Bark decoctions are traditionally used for fever and as a general tonic.',
            'habitat': 'SAVANNA',
            'local_names': [('Caïlcédrat', 'French', 'North'), ('Kuka', 'Hausa', 'Far North'), ('Madatchi', 'Fulfulde', 'Adamawa')],
            'regions': ['North', 'Far North', 'Adamawa'],
            'parts': ['BARK', 'SEED', 'LEAF'],
        },
        {
            'scientific_name': 'Nauclea latifolia',
            'common_name': 'African Peach',
            'family': 'Rubiaceae',
            'genus': 'Nauclea',
            'description': 'A savanna shrub bearing a distinctive red-veined fruit. Root and bark preparations are widely used in the northern regions for fever and digestive complaints.',
            'habitat': 'SAVANNA',
            'local_names': [('Pêcher africain', 'French', 'North'), ('Tabashiya', 'Hausa', 'North'), ('Bali', 'Fulfulde', 'Adamawa')],
            'regions': ['North', 'Adamawa', 'Centre'],
            'parts': ['ROOT', 'BARK', 'FRUIT'],
        },
        {
            'scientific_name': 'Piper guineense',
            'common_name': 'Ashanti Pepper',
            'family': 'Piperaceae',
            'genus': 'Piper',
            'description': 'A forest vine whose pungent seeds and leaves are essential to Cameroonian cooking and to post-partum traditional care. It also appears in preparations for cough and respiratory complaints.',
            'habitat': 'FOREST',
            'local_names': [('Poivre de Guinée', 'French', 'Centre'), ('Uziza', 'Igbo', 'Southwest'), ('Ndjansang', 'Ewondo', 'Centre')],
            'regions': ['Southwest', 'Littoral', 'Centre', 'South'],
            'parts': ['SEED', 'FRUIT', 'LEAF'],
        },
        {
            'scientific_name': 'Tetrapleura tetraptera',
            'common_name': 'Prekese',
            'family': 'Fabaceae',
            'genus': 'Tetrapleura',
            'description': 'A forest tree bearing a distinctive four-winged aromatic fruit. The fruit is used both as a cooking spice and in preparations taken by women after childbirth.',
            'habitat': 'FOREST',
            'local_names': [('Aridan', 'Yoruba', 'Littoral'), ('Essissang', 'Ewondo', 'Centre')],
            'regions': ['Centre', 'South', 'Littoral'],
            'parts': ['FRUIT', 'BARK', 'SEED'],
        },
        {
            'scientific_name': 'Xylopia aethiopica',
            'common_name': 'Ethiopian Pepper',
            'family': 'Annonaceae',
            'genus': 'Xylopia',
            'description': 'A forest tree whose clustered, peppery fruits are dried and sold in markets countrywide. It is used in spice mixtures, in cough remedies and in post-partum care.',
            'habitat': 'FOREST',
            'local_names': [('Poivre de Guinée', 'French', 'Centre'), ('Ndjoh', 'Ewondo', 'Centre'), ('Kimba', 'Bulu', 'South')],
            'regions': ['Centre', 'East', 'South', 'Littoral'],
            'parts': ['FRUIT', 'SEED', 'BARK'],
        },
        {
            'scientific_name': 'Garcinia kola',
            'common_name': 'Bitter Kola',
            'family': 'Clusiaceae',
            'genus': 'Garcinia',
            'description': 'A forest tree whose bitter seeds are chewed socially and offered to guests across southern Cameroon. The seeds also feature in traditional remedies for cough and liver complaints.',
            'habitat': 'FOREST',
            'local_names': [('Cola amer', 'French', 'Centre'), ('Orogbo', 'Yoruba', 'Littoral'), ('Ekom', 'Ewondo', 'Centre')],
            'regions': ['South', 'Centre', 'Littoral', 'Southwest'],
            'parts': ['SEED', 'BARK'],
        },
        {
            'scientific_name': 'Picralima nitida',
            'common_name': 'Akuamma',
            'family': 'Apocynaceae',
            'genus': 'Picralima',
            'description': 'A forest tree whose seeds are among the better-documented traditional analgesics of Central Africa. Practitioners stress strict dosing because the seeds are pharmacologically active.',
            'habitat': 'FOREST',
            'local_names': [('Akuamma', 'Ashanti', 'Southwest'), ('Eban', 'Ewondo', 'Centre')],
            'regions': ['Centre', 'South', 'East'],
            'parts': ['SEED', 'BARK', 'ROOT'],
        },
        {
            'scientific_name': 'Enantia chlorantha',
            'common_name': 'African Yellow Wood',
            'family': 'Annonaceae',
            'genus': 'Enantia',
            'description': 'A forest tree with intensely yellow bark used in bitter tonics across the forest zone. It is one of the most commonly cited plants in southern Cameroonian fever preparations.',
            'habitat': 'FOREST',
            'local_names': [('Moambé jaune', 'French', 'Centre'), ('Ntom', 'Ewondo', 'Centre')],
            'regions': ['Centre', 'East', 'South', 'Littoral'],
            'parts': ['BARK', 'ROOT'],
        },
        {
            'scientific_name': 'Voacanga africana',
            'common_name': 'Voacanga',
            'family': 'Apocynaceae',
            'genus': 'Voacanga',
            'description': 'A small forest tree whose bark and seeds contain alkaloids of pharmacological interest. Traditional use is limited and cautious, and it is mainly documented by experienced healers.',
            'habitat': 'FOREST',
            'local_names': [('Voacanga', 'French', 'Centre'), ('Akondok', 'Ewondo', 'Centre')],
            'regions': ['Centre', 'South', 'Littoral'],
            'parts': ['BARK', 'SEED', 'ROOT'],
        },
        {
            'scientific_name': 'Annona muricata',
            'common_name': 'Soursop',
            'family': 'Annonaceae',
            'genus': 'Annona',
            'description': 'A small fruit tree planted widely in coastal and forest gardens. Leaf infusions and the fruit pulp are common in household preparations, though the plant is also the subject of safety debate.',
            'habitat': 'URBAN',
            'local_names': [('Corossol', 'French', 'Littoral'), ('Sap-sap', 'Duala', 'Littoral')],
            'regions': ['Littoral', 'Centre', 'Southwest', 'South'],
            'parts': ['LEAF', 'FRUIT', 'SEED', 'ROOT'],
        },
        {
            'scientific_name': 'Senna alata',
            'common_name': 'Candle Bush',
            'family': 'Fabaceae',
            'genus': 'Senna',
            'description': 'A shrub with striking yellow flower spikes, naturalized along roadsides and in gardens. Crushed leaves are the classic traditional application for ringworm and other fungal skin conditions.',
            'habitat': 'URBAN',
            'local_names': [('Cassier', 'French', 'Centre'), ('Ringworm bush', 'English', 'Southwest')],
            'regions': ['Centre', 'Littoral', 'West', 'South'],
            'parts': ['LEAF', 'FLOWER'],
        },
        {
            'scientific_name': 'Ageratum conyzoides',
            'common_name': 'Billy Goat Weed',
            'family': 'Asteraceae',
            'genus': 'Ageratum',
            'description': 'A common roadside herb of the highlands. It is used fresh as a wound dressing and is among the most accessible first-aid plants in rural Cameroon.',
            'habitat': 'URBAN',
            'local_names': [('Herbe à bouc', 'French', 'West'), ('Nkoo', 'Bamileke', 'West')],
            'regions': ['West', 'Northwest', 'Centre'],
            'parts': ['LEAF', 'WHOLE'],
        },
        {
            'scientific_name': 'Chromolaena odorata',
            'common_name': 'Siam Weed',
            'family': 'Asteraceae',
            'genus': 'Chromolaena',
            'description': 'An invasive shrub of fallows and roadsides that has nonetheless entered the pharmacopoeia. Fresh leaf squeeze is widely used to stop bleeding from minor cuts.',
            'habitat': 'SAVANNA',
            'local_names': [('Herbe du Laos', 'French', 'Centre'), ('Ntongnong', 'Ewondo', 'Centre')],
            'regions': ['Centre', 'East', 'South', 'Littoral'],
            'parts': ['LEAF', 'STEM'],
        },
        {
            'scientific_name': 'Securidaca longipedunculata',
            'common_name': 'Violet Tree',
            'family': 'Polygalaceae',
            'genus': 'Securidaca',
            'description': 'A savanna shrub with fragrant violet flowers and a strongly scented root. Root preparations are used in the northern regions, but over-harvesting has made the species locally scarce.',
            'habitat': 'SAVANNA',
            'local_names': [('Violet tree', 'English', 'North'), ('Alali', 'Fulfulde', 'Adamawa')],
            'regions': ['North', 'Far North', 'Adamawa'],
            'parts': ['ROOT', 'BARK', 'LEAF'],
        },
        {
            'scientific_name': 'Anogeissus leiocarpa',
            'common_name': 'African Birch',
            'family': 'Combretaceae',
            'genus': 'Anogeissus',
            'description': 'A savanna tree whose bark and leaves yield a yellow dye and astringent preparations. It is used in the Sudano-Sahelian zone for skin complaints and wound washing.',
            'habitat': 'SAVANNA',
            'local_names': [('Bouleau d’Afrique', 'French', 'North'), ('Marike', 'Hausa', 'Far North')],
            'regions': ['North', 'Far North', 'Adamawa'],
            'parts': ['BARK', 'LEAF', 'ROOT'],
        },
        {
            'scientific_name': 'Zanthoxylum gilletii',
            'common_name': 'African Satinwood',
            'family': 'Rutaceae',
            'genus': 'Zanthoxylum',
            'description': 'A forest tree with prickly bark and numbing, peppery seeds. Bark and root preparations are used for toothache and oral infections throughout the forest zone.',
            'habitat': 'FOREST',
            'local_names': [('Fagara', 'French', 'Centre'), ('Nkaa', 'Ewondo', 'Centre')],
            'regions': ['Centre', 'East', 'South'],
            'parts': ['BARK', 'ROOT', 'FRUIT'],
        },
    ]

    def _plants(self, regions):
        plants = {}
        for index, data in enumerate(self.PLANTS):
            plant, created = Plant.objects.get_or_create(
                scientific_name=data['scientific_name'],
                defaults={
                    'common_name': data['common_name'],
                    'family': data['family'],
                    'genus': data['genus'],
                    'description': data['description'],
                    'habitat': data['habitat'],
                    'image_credit': 'HerbaCam demo artwork — generated illustration, not a photograph',
                    'is_published': True,
                },
            )
            if created or plant_image_missing(plant):
                set_plant_image(plant, PLANT_ARTWORK[index % len(PLANT_ARTWORK)])

            for name, language, region_name in data['local_names']:
                PlantLocalName.objects.get_or_create(
                    plant=plant, name=name, language=language,
                    defaults={'region': regions.get(region_name)},
                )
            for part_type in data['parts']:
                PlantPart.objects.get_or_create(plant=plant, part_type=part_type)
            for region_name in data['regions']:
                region = regions.get(region_name)
                if region:
                    plant.regions.add(region)
            plants[data['scientific_name']] = plant
        return plants

    # -------------------------------------------------------- traditional uses

    TRADITIONAL_USES = [
        # plant, symptom, part, preparation, region, description, cultural context
        ('Azadirachta indica', 'Malaria', 'LEAF', 'DECOCTION', 'Far North',
         'Leaf decoction taken as a bitter tea during malarial episodes.',
         'Neem is planted beside compounds specifically so leaves are available during fever seasons.'),
        ('Azadirachta indica', 'Fever', 'BARK', 'DECOCTION', 'North',
         'Bark decoction used to bring down prolonged fever.', ''),
        ('Azadirachta indica', 'Skin rash', 'LEAF', 'POULTICE', 'Adamawa',
         'Crushed leaves applied to itchy skin eruptions.', ''),
        ('Azadirachta indica', 'Intestinal worms', 'SEED', 'POWDER', 'North',
         'Dried seed powder taken in small amounts as a deworming preparation.',
         'Dosing is deliberately conservative because the seeds are considered strong.'),
        ('Azadirachta indica', 'Toothache', 'STEM', 'RAW', 'Far North',
         'A fresh twig is chewed as a chewing stick for oral hygiene and tooth pain.', ''),
        ('Moringa oleifera', 'Fatigue', 'LEAF', 'INFUSION', 'North',
         'Dried leaf infusion taken as a strengthening tonic during periods of tiredness.', ''),
        ('Moringa oleifera', 'Anaemia', 'LEAF', 'POWDER', 'North',
         'Leaf powder stirred into porridge as a nutritional supplement after illness.', ''),
        ('Moringa oleifera', 'Diabetes', 'LEAF', 'INFUSION', 'Centre',
         'Leaf infusion taken before meals by households managing sugar levels.',
         'Increasingly cited by urban households alongside conventional care.'),
        ('Moringa oleifera', 'Hypertension', 'LEAF', 'INFUSION', 'Adamawa',
         'Unsalted leaf infusion drunk in the morning.', ''),
        ('Prunus africana', 'Prostate complaints', 'BARK', 'DECOCTION', 'Southwest',
         'Bark decoction traditionally used for urinary difficulty in older men.',
         'Harvesting is regulated by community rules because the bark regrows slowly.'),
        ('Prunus africana', 'Rheumatism', 'BARK', 'POWDER', 'Northwest',
         'Ground bark powder taken with food for joint pain.', ''),
        ('Prunus africana', 'Stomach ache', 'BARK', 'DECOCTION', 'West',
         'Small-dose bark decoction used for abdominal complaints.', ''),
        ('Vernonia amygdalina', 'Malaria', 'LEAF', 'JUICE', 'Littoral',
         'Fresh leaf juice squeezed and taken as a bitter tonic for fever.',
         'The bitterness itself is considered evidence of the preparation’s strength.'),
        ('Vernonia amygdalina', 'Diabetes', 'LEAF', 'INFUSION', 'Centre',
         'Leaf infusion taken before meals by people managing blood sugar.', ''),
        ('Vernonia amygdalina', 'Stomach ache', 'LEAF', 'DECOCTION', 'Northwest',
         'Leaf decoction drunk for abdominal discomfort.', ''),
        ('Vernonia amygdalina', 'Loss of appetite', 'LEAF', 'JUICE', 'West',
         'Diluted leaf juice given to restore appetite after illness.', ''),
        ('Vernonia amygdalina', 'Intestinal worms', 'LEAF', 'JUICE', 'Southwest',
         'Small quantities of leaf juice taken in the morning as a cleansing preparation.', ''),
        ('Cola acuminata', 'Fatigue', 'SEED', 'RAW', 'Littoral',
         'Kola nuts chewed to stay alert during long work or travel.', ''),
        ('Cola acuminata', 'Headache', 'SEED', 'RAW', 'Centre',
         'Kola chewed alongside rest to relieve headache and heaviness.',
         'Kola is offered to guests before any conversation begins.'),
        ('Cola acuminata', 'Loss of appetite', 'SEED', 'RAW', 'South',
         'Small pieces of kola chewed to stimulate appetite.', ''),
        ('Cola acuminata', 'Nausea', 'BARK', 'DECOCTION', 'East',
         'Bark decoction taken in sips for nausea.', ''),
        ('Alstonia boonei', 'Malaria', 'BARK', 'DECOCTION', 'East',
         'Bark decoction is the most cited traditional anti-malarial preparation in the forest zone.',
         'Considered one of the most important anti-malarial plants in eastern Cameroon.'),
        ('Alstonia boonei', 'Fever', 'LEAF', 'INFUSION', 'South',
         'Leaf infusion used to reduce fever.', ''),
        ('Alstonia boonei', 'Rheumatism', 'BARK', 'DECOCTION', 'Centre',
         'Warm bark decoction taken and used as a wash for painful joints.', ''),
        ('Alstonia boonei', 'Diarrhea', 'BARK', 'DECOCTION', 'Littoral',
         'Small-dose bark decoction taken for persistent diarrhea.', ''),
        ('Ocimum gratissimum', 'Cough', 'LEAF', 'INFUSION', 'Centre',
         'Leaf infusion drunk warm for cough and chest tightness.', ''),
        ('Ocimum gratissimum', 'Stomach ache', 'LEAF', 'JUICE', 'West',
         'Fresh leaf juice diluted in water for abdominal pain.', ''),
        ('Ocimum gratissimum', 'Fever', 'LEAF', 'BATH', 'Southwest',
         'Leaves are boiled and the water used as a cooling medicinal bath.', ''),
        ('Ocimum gratissimum', 'Nausea', 'LEAF', 'INFUSION', 'Northwest',
         'Mild leaf infusion sipped for nausea.', ''),
        ('Ocimum gratissimum', 'Diarrhea', 'LEAF', 'DECOCTION', 'Littoral',
         'Leaf decoction taken for loose stools.', ''),
        ('Rauvolfia vomitoria', 'Hypertension', 'ROOT', 'DECOCTION', 'South',
         'Root decoction traditionally used for blood pressure management.',
         'Healers emphasise careful dosing because the root is considered very strong.'),
        ('Rauvolfia vomitoria', 'Insomnia', 'ROOT', 'DECOCTION', 'Centre',
         'Very small doses of root decoction used to induce sleep.', ''),
        ('Rauvolfia vomitoria', 'Headache', 'BARK', 'DECOCTION', 'West',
         'Dilute bark decoction taken for severe headache.', ''),
        ('Zingiber officinale', 'Nausea', 'TUBER', 'INFUSION', 'Centre',
         'Fresh rhizome infusion sipped for nausea and motion sickness.', ''),
        ('Zingiber officinale', 'Cough', 'TUBER', 'DECOCTION', 'North',
         'Ginger and honey decoction taken for cough and sore throat.', ''),
        ('Zingiber officinale', 'Menstrual pain', 'TUBER', 'INFUSION', 'West',
         'Warm ginger infusion taken during painful menstruation.', ''),
        ('Zingiber officinale', 'Loss of appetite', 'TUBER', 'RAW', 'Far North',
         'Thin slices of fresh rhizome chewed before meals.', ''),
        ('Zingiber officinale', 'Rheumatism', 'TUBER', 'POULTICE', 'Adamawa',
         'Crushed ginger applied warm to painful joints.', ''),
        ('Curcuma longa', 'Wounds', 'TUBER', 'POWDER', 'Centre',
         'Dried rhizome powder sprinkled on minor wounds as a drying agent.', ''),
        ('Curcuma longa', 'Ulcers', 'TUBER', 'INFUSION', 'Littoral',
         'Rhizome infusion taken for gastric discomfort.', ''),
        ('Curcuma longa', 'Skin rash', 'TUBER', 'OINTMENT', 'North',
         'Rhizome paste applied to irritated skin.', ''),
        ('Allium sativum', 'Hypertension', 'TUBER', 'RAW', 'North',
         'Crushed cloves macerated in water and taken in the morning.', ''),
        ('Allium sativum', 'Cough', 'TUBER', 'INFUSION', 'Far North',
         'Garlic and honey maceration taken for cough.', ''),
        ('Allium sativum', 'Intestinal worms', 'TUBER', 'RAW', 'Adamawa',
         'Raw cloves eaten on an empty stomach as a cleansing preparation.', ''),
        ('Aloe vera', 'Burns', 'SAP', 'OINTMENT', 'Centre',
         'Fresh leaf gel applied directly to minor burns.', ''),
        ('Aloe vera', 'Wounds', 'LEAF', 'POULTICE', 'North',
         'Split leaf applied to cuts to keep them moist and clean.', ''),
        ('Aloe vera', 'Skin rash', 'SAP', 'OINTMENT', 'West',
         'Leaf gel rubbed onto itchy or inflamed skin.', ''),
        ('Aloe vera', 'Constipation', 'SAP', 'JUICE', 'Adamawa',
         'Diluted leaf juice taken as a mild laxative.', ''),
        ('Carica papaya', 'Malaria', 'LEAF', 'DECOCTION', 'Centre',
         'Leaf decoction taken as a bitter tea during fever.', ''),
        ('Carica papaya', 'Dysentery', 'SEED', 'POWDER', 'Littoral',
         'Dried seed powder taken in small amounts for intestinal complaints.', ''),
        ('Carica papaya', 'Wounds', 'FRUIT', 'POULTICE', 'West',
         'Unripe fruit pulp applied to slow-healing wounds.', ''),
        ('Carica papaya', 'Intestinal worms', 'SEED', 'JUICE', 'South',
         'Seed juice taken in small doses as a deworming preparation.', ''),
        ('Carica papaya', 'Constipation', 'FRUIT', 'RAW', 'East',
         'Ripe fruit eaten to ease bowel movements.', ''),
        ('Mangifera indica', 'Diarrhea', 'BARK', 'DECOCTION', 'North',
         'Bark decoction taken for watery stools.', ''),
        ('Mangifera indica', 'Cough', 'LEAF', 'INFUSION', 'West',
         'Young leaf infusion taken for cough and throat irritation.', ''),
        ('Mangifera indica', 'Toothache', 'BARK', 'DECOCTION', 'Centre',
         'Bark decoction used as a mouth rinse for tooth pain.', ''),
        ('Mangifera indica', 'Fever', 'LEAF', 'BATH', 'Adamawa',
         'Leaf bath given to children with fever.', ''),
        ('Psidium guajava', 'Diarrhea', 'LEAF', 'DECOCTION', 'Centre',
         'Young leaf decoction is the most widely used household preparation for diarrhea.', ''),
        ('Psidium guajava', 'Dysentery', 'BARK', 'DECOCTION', 'West',
         'Bark decoction taken for bloody diarrhea.', ''),
        ('Psidium guajava', 'Wounds', 'LEAF', 'POULTICE', 'Littoral',
         'Crushed young leaves applied to cuts.', ''),
        ('Psidium guajava', 'Nausea', 'LEAF', 'INFUSION', 'North',
         'Mild leaf infusion sipped to settle the stomach.', ''),
        ('Cymbopogon citratus', 'Fever', 'LEAF', 'INFUSION', 'West',
         'Lemongrass tea taken hot to induce sweating during fever.', ''),
        ('Cymbopogon citratus', 'Cough', 'LEAF', 'INFUSION', 'Northwest',
         'Lemongrass and ginger infusion taken for cough.', ''),
        ('Cymbopogon citratus', 'Stomach ache', 'LEAF', 'INFUSION', 'Centre',
         'Warm lemongrass infusion drunk after meals.', ''),
        ('Cymbopogon citratus', 'Hypertension', 'LEAF', 'INFUSION', 'North',
         'Unsweetened lemongrass tea drunk daily.', ''),
        ('Khaya senegalensis', 'Malaria', 'BARK', 'DECOCTION', 'North',
         'Bitter bark decoction taken for malaria-like fevers.',
         'Bark is sold in northern markets bundled with neem as a fever pair.'),
        ('Khaya senegalensis', 'Fever', 'BARK', 'BATH', 'Far North',
         'Bark decoction added to bathing water for fever.', ''),
        ('Khaya senegalensis', 'Skin rash', 'BARK', 'POWDER', 'Adamawa',
         'Dried bark powder applied to skin eruptions.', ''),
        ('Nauclea latifolia', 'Malaria', 'ROOT', 'DECOCTION', 'North',
         'Root decoction taken as a bitter fever preparation.', ''),
        ('Nauclea latifolia', 'Dysentery', 'BARK', 'DECOCTION', 'Adamawa',
         'Bark decoction taken for intestinal complaints.', ''),
        ('Nauclea latifolia', 'Jaundice', 'ROOT', 'DECOCTION', 'Centre',
         'Root decoction used in preparations for yellowing of the eyes.', ''),
        ('Piper guineense', 'Cough', 'SEED', 'POWDER', 'Southwest',
         'Ground seeds mixed with honey and taken for cough.', ''),
        ('Piper guineense', 'Menstrual pain', 'SEED', 'DECOCTION', 'Centre',
         'Seed decoction taken after childbirth and during painful menstruation.', ''),
        ('Piper guineense', 'Fatigue', 'LEAF', 'INFUSION', 'Littoral',
         'Leaf infusion taken as a warming tonic.', ''),
        ('Tetrapleura tetraptera', 'Menstrual pain', 'FRUIT', 'DECOCTION', 'Centre',
         'Fruit decoction given to women after childbirth.',
         'The fruit is a standard element of post-partum care across the forest zone.'),
        ('Tetrapleura tetraptera', 'Cough', 'FRUIT', 'DECOCTION', 'South',
         'Fruit decoction taken for persistent cough.', ''),
        ('Tetrapleura tetraptera', 'Rheumatism', 'BARK', 'BATH', 'Littoral',
         'Bark infusion added to bathing water for joint pain.', ''),
        ('Xylopia aethiopica', 'Cough', 'FRUIT', 'DECOCTION', 'Centre',
         'Dried fruits boiled and the steam inhaled for cough.', ''),
        ('Xylopia aethiopica', 'Menstrual pain', 'FRUIT', 'POWDER', 'East',
         'Powdered fruit taken in warm water after childbirth.', ''),
        ('Xylopia aethiopica', 'Stomach ache', 'FRUIT', 'DECOCTION', 'South',
         'Fruit decoction taken for abdominal pain.', ''),
        ('Garcinia kola', 'Cough', 'SEED', 'RAW', 'South',
         'Bitter kola chewed for cough and throat irritation.',
         'Bitter kola and kola nut are presented together in hospitality rites.'),
        ('Garcinia kola', 'Jaundice', 'SEED', 'POWDER', 'Centre',
         'Seed powder taken in preparations for liver complaints.', ''),
        ('Garcinia kola', 'Asthma', 'SEED', 'RAW', 'Littoral',
         'Seed chewed to ease breathing difficulty.', ''),
        ('Picralima nitida', 'Headache', 'SEED', 'POWDER', 'Centre',
         'Seed powder taken in very small amounts for pain.',
         'Healers describe the seed as "strong medicine" and warn against repeated dosing.'),
        ('Picralima nitida', 'Malaria', 'SEED', 'POWDER', 'South',
         'Seed powder taken for fever episodes.', ''),
        ('Picralima nitida', 'Stomach ache', 'BARK', 'DECOCTION', 'East',
         'Bark decoction taken for abdominal pain.', ''),
        ('Enantia chlorantha', 'Malaria', 'BARK', 'DECOCTION', 'Centre',
         'Yellow bark decoction taken as a bitter anti-fever tonic.', ''),
        ('Enantia chlorantha', 'Fever', 'BARK', 'DECOCTION', 'East',
         'Bark decoction taken for intermittent fever.', ''),
        ('Enantia chlorantha', 'Jaundice', 'BARK', 'DECOCTION', 'South',
         'Bark decoction used in preparations for jaundice.', ''),
        ('Voacanga africana', 'Rheumatism', 'BARK', 'DECOCTION', 'Centre',
         'Bark decoction used sparingly for joint pain.', ''),
        ('Voacanga africana', 'Headache', 'ROOT', 'POWDER', 'South',
         'Root powder used in very small amounts for severe headache.', ''),
        ('Annona muricata', 'Fatigue', 'LEAF', 'INFUSION', 'Littoral',
         'Leaf infusion taken as a restorative drink.', ''),
        ('Annona muricata', 'Insomnia', 'LEAF', 'INFUSION', 'Centre',
         'Leaf infusion taken in the evening to promote sleep.', ''),
        ('Annona muricata', 'Hypertension', 'LEAF', 'INFUSION', 'Southwest',
         'Leaf infusion drunk as part of household blood-pressure care.', ''),
        ('Senna alata', 'Skin rash', 'LEAF', 'POULTICE', 'Centre',
         'Crushed leaves rubbed on ringworm and other fungal rashes.',
         'Often the first remedy tried for childhood ringworm.'),
        ('Senna alata', 'Wounds', 'LEAF', 'POULTICE', 'West',
         'Leaf paste applied to minor skin sores.', ''),
        ('Ageratum conyzoides', 'Wounds', 'LEAF', 'POULTICE', 'West',
         'Fresh crushed leaves pressed onto cuts to stop bleeding.', ''),
        ('Ageratum conyzoides', 'Skin rash', 'WHOLE', 'BATH', 'Northwest',
         'Whole plant boiled and added to bathing water for itchy skin.', ''),
        ('Chromolaena odorata', 'Wounds', 'LEAF', 'JUICE', 'Centre',
         'Leaf juice squeezed directly onto cuts to stop bleeding.', ''),
        ('Chromolaena odorata', 'Burns', 'LEAF', 'POULTICE', 'East',
         'Crushed leaves applied to minor burns.', ''),
        ('Securidaca longipedunculata', 'Rheumatism', 'ROOT', 'POWDER', 'North',
         'Root powder taken in small amounts for joint pain.',
         'The root is becoming scarce locally, and healers now travel farther to source it.'),
        ('Securidaca longipedunculata', 'Headache', 'ROOT', 'SMOKE', 'Adamawa',
         'Root smoke inhaled for severe headache.', ''),
        ('Securidaca longipedunculata', 'Snake bite', 'ROOT', 'POULTICE', 'Far North',
         'Root paste applied to the bite site as a first measure before referral.',
         'Healers insist this is a first-aid measure only and that patients must reach a clinic.'),
        ('Anogeissus leiocarpa', 'Wounds', 'BARK', 'POWDER', 'North',
         'Dried bark powder dusted on wounds as an astringent.', ''),
        ('Anogeissus leiocarpa', 'Skin rash', 'LEAF', 'BATH', 'Far North',
         'Leaf decoction added to washing water for skin complaints.', ''),
        ('Anogeissus leiocarpa', 'Dysentery', 'BARK', 'DECOCTION', 'Adamawa',
         'Bark decoction taken for dysentery.', ''),
        ('Zanthoxylum gilletii', 'Toothache', 'BARK', 'RAW', 'Centre',
         'Bark or seed chewed to numb tooth pain.', ''),
        ('Zanthoxylum gilletii', 'Eye infection', 'ROOT', 'JUICE', 'East',
         'Highly diluted root preparation used as an eye wash.', ''),
        ('Zanthoxylum gilletii', 'Ulcers', 'BARK', 'DECOCTION', 'South',
         'Bark decoction taken for gastric ulcers.', ''),
    ]

    def _traditional_uses(self, plants, symptoms, regions, methods, users):
        practitioners = [u for u in users.values() if u.role == User.Role.PRACTITIONER]
        experts = [u for u in users.values() if u.role == User.Role.EXPERT]
        now = timezone.now()
        created = 0

        for index, (pname, sname, ptype, prep, rname, desc, context) in enumerate(self.TRADITIONAL_USES):
            plant = plants.get(pname)
            symptom = symptoms.get(sname)
            if not plant or not symptom:
                continue
            region = regions.get(rname)
            part = PlantPart.objects.filter(plant=plant, part_type=ptype).first()
            contributor = practitioners[index % len(practitioners)]
            is_verified = index % 5 != 0  # ~80% verified

            use, was_created = TraditionalUse.objects.get_or_create(
                plant=plant, symptom=symptom, region=region, description=desc,
                defaults={
                    'plant_part': part,
                    'preparation': methods.get(prep),
                    'community': Community.objects.filter(region=region).first() if region else None,
                    'cultural_context': context,
                    'is_verified': is_verified,
                    'source': f'Documented by {contributor.get_full_name() or contributor.username} (HerbaCam demo dataset)',
                    'contributor': contributor,
                    'verified_by': RANDOM.choice(experts) if is_verified else None,
                },
            )
            if was_created:
                created += 1
                when = now - timedelta(days=RANDOM.randint(20, 400), hours=RANDOM.randint(0, 23))
                self._stamp(use, 'created_at', when)
        return created

    # ----------------------------------------------------------------- evidence

    EVIDENCE = [
        ('Azadirachta indica', 'MODERATE', 'In-vitro studies report inhibitory activity of neem leaf extracts against Plasmodium falciparum, but clinical evidence in humans remains limited.', 'Journal of Ethnopharmacology (DEMO REFERENCE)'),
        ('Azadirachta indica', 'PRELIMINARY', 'Animal studies suggest aqueous leaf extracts may reduce blood glucose, though study quality varies.', 'African Journal of Traditional Medicine (DEMO REFERENCE)'),
        ('Moringa oleifera', 'STRONG', 'Nutritional composition of moringa leaves is well documented, with consistently high levels of iron, calcium and vitamin A precursors.', 'Food Chemistry (DEMO REFERENCE)'),
        ('Moringa oleifera', 'PRELIMINARY', 'Small human trials report modest improvements in fasting glucose, but sample sizes are small.', 'Phytotherapy Research (DEMO REFERENCE)'),
        ('Prunus africana', 'MODERATE', 'Standardised bark extracts have been studied for benign prostatic hyperplasia with mixed but generally positive symptom outcomes.', 'Cochrane-style review (DEMO REFERENCE)'),
        ('Prunus africana', 'INSUFFICIENT', 'Conservation pressure limits the body of pharmacological research; most studies rely on wild-harvested material.', 'Conservation Biology (DEMO REFERENCE)'),
        ('Vernonia amygdalina', 'MODERATE', 'Multiple animal studies report hypoglycaemic and anti-parasitic activity of leaf extracts.', 'Journal of Ethnopharmacology (DEMO REFERENCE)'),
        ('Vernonia amygdalina', 'PRELIMINARY', 'In-vitro cytotoxicity against several cell lines has been reported, without clinical confirmation.', 'African Journal of Biotechnology (DEMO REFERENCE)'),
        ('Alstonia boonei', 'MODERATE', 'Stem bark extracts show anti-plasmodial activity in rodent malaria models, supporting the traditional anti-malarial use.', 'Malaria Journal (DEMO REFERENCE)'),
        ('Alstonia boonei', 'PRELIMINARY', 'Anti-inflammatory activity has been reported in carrageenan-induced paw oedema models.', 'Journal of Medicinal Plants Research (DEMO REFERENCE)'),
        ('Ocimum gratissimum', 'MODERATE', 'Essential oil composition and antimicrobial activity of Ocimum gratissimum are well characterized.', 'Journal of Essential Oil Research (DEMO REFERENCE)'),
        ('Ocimum gratissimum', 'PRELIMINARY', 'Limited animal data suggest gastroprotective effects of leaf extracts.', 'Nigerian Journal of Natural Products (DEMO REFERENCE)'),
        ('Rauvolfia vomitoria', 'MODERATE', 'Reserpine and related alkaloids from Rauvolfia species are historically documented antihypertensive agents with a narrow therapeutic window.', 'Pharmacological Reviews (DEMO REFERENCE)'),
        ('Zingiber officinale', 'STRONG', 'Ginger has consistent clinical evidence for reducing nausea, including post-operative and pregnancy-associated nausea.', 'Systematic review (DEMO REFERENCE)'),
        ('Zingiber officinale', 'MODERATE', 'Trials report modest reductions in dysmenorrhoea pain compared with placebo.', 'Journal of Pain Research (DEMO REFERENCE)'),
        ('Curcuma longa', 'MODERATE', 'Curcumin has documented anti-inflammatory activity, though bioavailability remains the main limitation.', 'Journal of Medicinal Chemistry (DEMO REFERENCE)'),
        ('Curcuma longa', 'PRELIMINARY', 'Topical curcumin formulations have been explored for wound healing in small studies.', 'Wound Repair and Regeneration (DEMO REFERENCE)'),
        ('Allium sativum', 'MODERATE', 'Meta-analyses report modest but consistent blood-pressure reductions with garlic preparations.', 'Journal of Hypertension (DEMO REFERENCE)'),
        ('Allium sativum', 'INSUFFICIENT', 'Evidence for lipid-lowering is inconsistent across trials.', 'Nutrition Reviews (DEMO REFERENCE)'),
        ('Aloe vera', 'MODERATE', 'Topical aloe gel has supporting evidence for minor burn healing and skin irritation.', 'Journal of Dermatological Treatment (DEMO REFERENCE)'),
        ('Aloe vera', 'INSUFFICIENT', 'Oral aloe latex has laxative effects but is associated with safety concerns at higher doses.', 'Safety review (DEMO REFERENCE)'),
        ('Carica papaya', 'MODERATE', 'Controlled trials in Nigeria reported faster recovery in dengue patients receiving Carica papaya leaf extract, warranting further study.', 'Journal of Tropical Medicine (DEMO REFERENCE)'),
        ('Carica papaya', 'PRELIMINARY', 'Seed extracts show anti-parasitic activity in laboratory models.', 'Parasitology Research (DEMO REFERENCE)'),
        ('Mangifera indica', 'PRELIMINARY', 'Mangiferin from mango bark and leaves shows anti-inflammatory and antioxidant activity in preclinical studies.', 'Phytomedicine (DEMO REFERENCE)'),
        ('Psidium guajava', 'MODERATE', 'Clinical studies report reduced duration of diarrhoea with guava leaf preparations, attributed to quercetin and tannins.', 'Journal of Tropical Pediatrics (DEMO REFERENCE)'),
        ('Cymbopogon citratus', 'PRELIMINARY', 'Animal studies report anxiolytic and anti-nociceptive effects of lemongrass essential oil.', 'Journal of Ethnopharmacology (DEMO REFERENCE)'),
        ('Khaya senegalensis', 'PRELIMINARY', 'Anti-plasmodial activity of limonoids from Khaya bark has been reported in vitro.', 'Planta Medica (DEMO REFERENCE)'),
        ('Nauclea latifolia', 'PRELIMINARY', 'Root extracts show anti-malarial and anti-diarrhoeal activity in rodent models.', 'Journal of Medicinal Plants Research (DEMO REFERENCE)'),
        ('Piper guineense', 'PRELIMINARY', 'Piperine and related amides show antimicrobial and anti-inflammatory activity in vitro.', 'Food Chemistry (DEMO REFERENCE)'),
        ('Tetrapleura tetraptera', 'PRELIMINARY', 'Fruit extracts show antioxidant and anti-inflammatory activity in animal studies.', 'Journal of Ethnopharmacology (DEMO REFERENCE)'),
        ('Xylopia aethiopica', 'PRELIMINARY', 'Fruit extracts show antimicrobial activity against common food-borne and oral bacteria.', 'Journal of Ethnopharmacology (DEMO REFERENCE)'),
        ('Garcinia kola', 'MODERATE', 'Kolaviron, a biflavonoid complex from Garcinia kola, has documented antioxidant and hepatoprotective activity in animal models.', 'Pharmacological Research (DEMO REFERENCE)'),
        ('Garcinia kola', 'PRELIMINARY', 'Broccoli-seed-like effects on blood glucose have been reported in small studies only.', 'Journal of Herbal Medicine (DEMO REFERENCE)'),
        ('Picralima nitida', 'MODERATE', 'Akuammine and related alkaloids show analgesic activity in animal models, consistent with traditional pain use.', 'Journal of Ethnopharmacology (DEMO REFERENCE)'),
        ('Picralima nitida', 'INSUFFICIENT', 'No well-controlled human trials have been identified.', 'Evidence gap review (DEMO REFERENCE)'),
        ('Enantia chlorantha', 'PRELIMINARY', 'Bark alkaloids show anti-malarial activity in vitro and in rodent models.', 'Journal of Ethnopharmacology (DEMO REFERENCE)'),
        ('Voacanga africana', 'INSUFFICIENT', 'Alkaloid content is pharmacologically interesting but traditional use is sparsely documented.', 'Phytochemistry review (DEMO REFERENCE)'),
        ('Annona muricata', 'INSUFFICIENT', 'Claims of anti-cancer activity are not supported by human trials, and annonacin neurotoxicity has been documented.', 'Safety review (DEMO REFERENCE)'),
        ('Senna alata', 'MODERATE', 'Clinical and laboratory studies support antifungal activity of Senna alata leaf extracts against dermatophytes.', 'Mycoses (DEMO REFERENCE)'),
        ('Ageratum conyzoides', 'PRELIMINARY', 'Wound-healing activity has been reported in excision wound models in rats.', 'Journal of Ethnopharmacology (DEMO REFERENCE)'),
        ('Chromolaena odorata', 'MODERATE', 'Aqueous leaf extracts have demonstrated haemostatic and wound-healing effects in animal and early human studies.', 'Journal of Wound Care (DEMO REFERENCE)'),
        ('Securidaca longipedunculata', 'INSUFFICIENT', 'Traditional use is well documented ethnographically but pharmacological study is sparse.', 'Ethnobotanical survey (DEMO REFERENCE)'),
        ('Anogeissus leiocarpa', 'PRELIMINARY', 'Bark extracts show antimicrobial and wound-healing activity in preclinical studies.', 'Journal of Ethnopharmacology (DEMO REFERENCE)'),
        ('Zanthoxylum gilletii', 'PRELIMINARY', 'Alkylamides from Zanthoxylum species show local anaesthetic and antimicrobial properties.', 'Fitoterapia (DEMO REFERENCE)'),
        ('Cola acuminata', 'MODERATE', 'Caffeine content of kola nut is well established; stimulant effects are consistent with its traditional use.', 'Food Chemistry (DEMO REFERENCE)'),
    ]

    def _evidence(self, plants, users):
        experts = [u for u in users.values() if u.role == User.Role.EXPERT]
        now = timezone.now()
        created = 0
        for index, (pname, level, summary, source) in enumerate(self.EVIDENCE):
            plant = plants.get(pname)
            if not plant:
                continue
            evidence, was_created = Evidence.objects.get_or_create(
                plant=plant, summary=summary,
                defaults={
                    'level': level,
                    'source': source,
                    'reference_url': '',
                    'publication_date': (now - timedelta(days=RANDOM.randint(200, 2500))).date(),
                    'reviewer': experts[index % len(experts)],
                },
            )
            if was_created:
                created += 1
                self._stamp(evidence, 'created_at', now - timedelta(days=RANDOM.randint(10, 500)))
        return created

    # ------------------------------------------------------------------- safety

    SAFETY = [
        ('Azadirachta indica', 'MODERATE', True, True,
         'Avoid during pregnancy and in young children. High or prolonged doses of neem oil have been associated with toxicity.',
         'Reye-like syndrome reported in children given neem oil.', 'Do not exceed traditional doses. Do not use neem oil internally in children.'),
        ('Moringa oleifera', 'LOW', False, False,
         'Leaf and seed preparations are generally well tolerated in food amounts.',
         '', 'Root and root bark should be avoided during pregnancy.'),
        ('Prunus africana', 'MODERATE', True, True,
         'Not recommended during pregnancy or for children. Sustainable sourcing is critical.',
         'Wild populations are threatened by bark harvesting.', 'Use only material from managed, legally sourced harvests.'),
        ('Vernonia amygdalina', 'LOW', False, False,
         'Safe in food amounts. The bitter taste can cause nausea when taken in concentrated form.',
         'Concentrated leaf juice may irritate the stomach.', 'Dilute leaf preparations; avoid on an empty stomach.'),
        ('Cola acuminata', 'LOW', False, False,
         'Caffeine content may disturb sleep and heart rhythm in sensitive people.',
         'May interact with stimulant medication.', 'Limit intake in the evening; caution with heart conditions.'),
        ('Alstonia boonei', 'MODERATE', True, False,
         'Use with caution during pregnancy. Bark decoctions are potent and should be taken in measured doses.',
         '', 'Do not combine with other anti-malarial preparations without professional advice.'),
        ('Ocimum gratissimum', 'LOW', False, False,
         'Generally safe as a culinary herb. Concentrated essential oil should not be ingested undiluted.',
         '', 'Essential oil is for external or aromatic use only unless professionally prepared.'),
        ('Rauvolfia vomitoria', 'HIGH', True, True,
         'This plant is potent and must be used only under the guidance of an experienced practitioner.',
         'Contains reserpine-like alkaloids; may cause marked hypotension and depression.',
         'Never self-dose. Contraindicated in pregnancy, depression and with antihypertensive drugs.'),
        ('Zingiber officinale', 'LOW', False, False,
         'Safe in culinary amounts. High doses may increase bleeding risk in people on anticoagulants.',
         'Mild heartburn reported at high doses.', 'Stop before scheduled surgery; caution with blood thinners.'),
        ('Curcuma longa', 'LOW', True, False,
         'Culinary use is safe. Medicinal doses should be avoided during pregnancy and with anticoagulants.',
         'Curcumin may reduce iron absorption at high doses.', 'Caution with warfarin and before surgery.'),
        ('Allium sativum', 'LOW', False, False,
         'Culinary use is safe; medicinal doses can increase bleeding risk.',
         'Documented interaction with anticoagulant medication.', 'Stop high-dose garlic before surgery.'),
        ('Aloe vera', 'LOW', True, False,
         'Topical gel is generally safe. Oral latex should be avoided during pregnancy and in children.',
         'Oral latex is a stimulant laxative with cramping risk.', 'Use gel externally; avoid oral latex.'),
        ('Carica papaya', 'MODERATE', True, False,
         'Unripe papaya latex and high-dose seed preparations should be avoided during pregnancy.',
         'Seed extracts may affect fertility at high doses in animal studies.', 'Ripe fruit is safe; medicinal seed preparations require care.'),
        ('Mangifera indica', 'LOW', False, False,
         'Leaf and bark preparations are generally well tolerated.',
         'Mango sap can cause contact dermatitis in sensitive people.', 'Avoid if allergic to Anacardiaceae (cashew/poison ivy family).'),
        ('Psidium guajava', 'LOW', False, False,
         'Leaf preparations are generally safe for short-term use.',
         '', 'Prolonged high-dose use may cause constipation.'),
        ('Cymbopogon citratus', 'LOW', True, False,
         'Safe as a beverage herb in normal amounts.',
         'High-dose essential oil is not for internal use.', 'Avoid medicinal doses during pregnancy.'),
        ('Khaya senegalensis', 'MODERATE', True, True,
         'Bitter bark preparations should be used sparingly and not given to children.',
         'High doses have been associated with liver enzyme changes in animal studies.', 'Short courses only; avoid in pregnancy.'),
        ('Nauclea latifolia', 'MODERATE', True, False,
         'Root preparations are potent; dosing should be conservative.',
         '', 'Not for use during pregnancy or in young children.'),
        ('Piper guineense', 'LOW', False, False,
         'Safe in culinary amounts.',
         'May interact with anticoagulant medication at medicinal doses.', 'Caution before surgery.'),
        ('Tetrapleura tetraptera', 'LOW', False, False,
         'Fruit preparations are well tolerated in food amounts.',
         '', 'Avoid medicinal doses during pregnancy.'),
        ('Xylopia aethiopica', 'LOW', True, False,
         'Culinary use is safe.',
         'High-dose fruit preparations have been studied for reproductive effects in animals.', 'Avoid medicinal doses during pregnancy.'),
        ('Garcinia kola', 'LOW', False, False,
         'Generally well tolerated when chewed in moderation.',
         'May lower blood glucose; caution for people on diabetes medication.', 'Monitor glucose if used alongside medication.'),
        ('Picralima nitida', 'HIGH', True, True,
         'Seeds are pharmacologically active. Only experienced practitioners should prepare them.',
         'Over-dosing has been associated with sedation and hypotension.', 'Never self-dose. Not for pregnancy or children.'),
        ('Enantia chlorantha', 'MODERATE', True, True,
         'Bitter bark preparations should be used in short courses.',
         'Traditional sources warn against prolonged use.', 'Avoid during pregnancy and in children.'),
        ('Voacanga africana', 'HIGH', True, True,
         'Contains active alkaloids; preparation is restricted to experienced practitioners.',
         'Cardiovascular effects possible at high doses.', 'Not for self-medication.'),
        ('Annona muricata', 'MODERATE', True, False,
         'Leaf infusions are widely used but should be limited in duration.',
         'Annonacin exposure has been linked to atypical parkinsonism in observational research.',
         'Avoid prolonged daily use; avoid during pregnancy.'),
        ('Senna alata', 'LOW', False, False,
         'Topical use is generally safe.',
         'Internal use has a laxative effect.', 'External use only unless professionally prepared.'),
        ('Ageratum conyzoides', 'MODERATE', True, False,
         'External use on intact skin only.',
         'Contains pyrrolizidine alkaloids; internal use is discouraged.', 'Do not take internally.'),
        ('Chromolaena odorata', 'LOW', False, False,
         'External use on minor cuts is common and generally well tolerated.',
         'May cause contact dermatitis in sensitive individuals.', 'External use only.'),
        ('Securidaca longipedunculata', 'HIGH', True, True,
         'Root preparations are considered toxic at high doses and are handled only by experienced healers.',
         'Documented toxicity of root bark preparations.', 'Not for self-medication. Never internal use without supervision.'),
        ('Anogeissus leiocarpa', 'LOW', False, False,
         'External and short-term internal use is generally well tolerated.',
         '', 'Avoid high-dose internal use in pregnancy.'),
        ('Zanthoxylum gilletii', 'MODERATE', True, False,
         'Chewing bark causes numbness; preparations should not be swallowed in quantity.',
         'Alkylamides can cause pronounced numbness and irritation.', 'Avoid during pregnancy; keep away from the eyes.'),
    ]

    def _safety(self, plants, users):
        experts = [u for u in users.values() if u.role == User.Role.EXPERT]
        created = 0
        for index, (pname, risk, preg, child, prec, concerns, dosage) in enumerate(self.SAFETY):
            plant = plants.get(pname)
            if not plant:
                continue
            record, was_created = SafetyInformation.objects.update_or_create(
                plant=plant,
                defaults={
                    'risk_level': risk,
                    'pregnancy_warning': preg,
                    'children_warning': child,
                    'precautions': prec,
                    'preparation_concerns': concerns,
                    'dosage_concerns': dosage,
                    'general_warning': 'DEMO safety record for educational purposes. Always consult a qualified healthcare professional.',
                    'reviewer': experts[index % len(experts)],
                    'is_verified': True,
                },
            )
            if was_created:
                created += 1
        return created

    # ----------------------------------------------------------------- articles

    CATEGORIES = [
        ('traditional-medicine', 'Traditional Medicine', 'Practices, history, and the role of healers in Cameroon.'),
        ('plant-profiles', 'Plant Profiles', 'Close-up looks at individual medicinal species.'),
        ('conservation', 'Conservation', 'Protecting plants and the knowledge attached to them.'),
        ('preparation', 'Preparation Methods', 'How remedies are prepared, dosed, and stored.'),
        ('safety-and-evidence', 'Safety & Evidence', 'What science says, and how to use information responsibly.'),
        ('community', 'Community Voices', 'Stories from practitioners and knowledge holders.'),
    ]

    def _articles(self, users):
        categories = {}
        for slug, name, description in self.CATEGORIES:
            category, _ = ArticleCategory.objects.get_or_create(
                slug=slug, defaults={'name': name, 'description': description}
            )
            categories[slug] = category

        experts = [u for u in users.values() if u.role == User.Role.EXPERT]
        admins = [u for u in users.values() if u.role == User.Role.ADMIN]
        now = timezone.now()

        articles = [
            {
                'title': 'Understanding Traditional Medicine in Cameroon',
                'slug': 'understanding-traditional-medicine',
                'category': 'traditional-medicine',
                'summary': 'An overview of how medicinal plant knowledge is organised across Cameroon’s ten regions.',
                'content': (
                    'Cameroon sits at the meeting point of several ecological zones: Sahelian plains in the far north, '
                    'high plateaus in the west, and equatorial rainforest across the south and east. Each zone has '
                    'produced its own pharmacopoeia, and each is carried by people rather than by books.\n\n'
                    '## A living, regional system\n\n'
                    'In the Far North, remedies tend to rely on drought-tolerant trees — neem, mahogany, baobab relatives '
                    '— prepared as bark decoctions. In the Western highlands, home gardens supply leaves: bitter leaf, '
                    'scent leaf, lemongrass. In the forest belt, healers work with a much larger palette, including '
                    'barks like Alstonia boonei and Enantia chlorantha.\n\n'
                    '## Why documentation matters\n\n'
                    'Knowledge of this kind is transmitted orally, usually within families. When a knowledge holder dies '
                    'without transmitting, specific recipes disappear — not the plant, but the knowledge of what to do '
                    'with it. Writing it down does not replace the healer; it creates a record that communities can keep.\n\n'
                    '## How HerbaCam handles it\n\n'
                    'HerbaCam separates three layers: what a community traditionally does, what a practitioner submits, '
                    'and what an expert has verified. Keeping them apart lets readers see exactly how well a claim is '
                    'substantiated.\n\n'
                    '*This article is sample content for demonstration purposes.*'
                ),
                'published': True,
                'days_ago': 96,
            },
            {
                'title': 'The Role of Evidence in Traditional Medicine',
                'slug': 'role-of-evidence',
                'category': 'safety-and-evidence',
                'summary': 'How scientific evidence relates to traditional claims, and how to read an evidence level.',
                'content': (
                    'Traditional use and scientific evidence answer different questions. One records what a community '
                    'has done for generations; the other asks whether an effect can be reproduced under controlled '
                    'conditions. Neither automatically invalidates the other.\n\n'
                    '## The four levels used here\n\n'
                    '- **Insufficient** — traditional use documented, no meaningful pharmacological study.\n'
                    '- **Preliminary** — laboratory or animal studies only.\n'
                    '- **Moderate** — some human data, or consistent preclinical data with a plausible mechanism.\n'
                    '- **Strong** — replicated clinical evidence.\n\n'
                    '## Reading a claim responsibly\n\n'
                    'A plant can be widely used and still be poorly studied; another can show promising laboratory '
                    'activity and never have been tested in humans. The evidence level is a statement about the state '
                    'of research, not a verdict on the tradition.\n\n'
                    '*This article is sample content for demonstration purposes.*'
                ),
                'published': True,
                'days_ago': 74,
            },
            {
                'title': 'Bitter Leaf (Vernonia amygdalina): A Cameroonian Treasure',
                'slug': 'bitter-leaf-profile',
                'category': 'plant-profiles',
                'summary': 'The most widely used medicinal plant in Cameroon, from the kitchen to the dispensary.',
                'content': (
                    'Known as "ndolé" in Duala and "bitter leaf" in English, Vernonia amygdalina is grown in compounds '
                    'across the forest zone. Its leaves are a vegetable first and a medicine second — which is precisely '
                    'why it is so well documented.\n\n'
                    '## Culinary and medicinal in one plant\n\n'
                    'The leaves are washed and pounded to remove some bitterness before being cooked. The squeezed juice, '
                    'which most cooks discard, is the part used medicinally — a reminder that "food" and "medicine" are '
                    'not separate categories in most Cameroonian households.\n\n'
                    '## What is documented\n\n'
                    'Household preparations include bitter leaf juice for fever and malaria-like illness, infusions taken '
                    'before meals, and diluted juice given to restore appetite after illness. Laboratory work has '
                    'reported hypoglycaemic and anti-parasitic activity, but human trials remain limited.\n\n'
                    '*This article is sample content for demonstration purposes.*'
                ),
                'published': True,
                'days_ago': 58,
            },
            {
                'title': 'Preserving Knowledge Before It Disappears',
                'slug': 'preserving-knowledge',
                'category': 'conservation',
                'summary': 'Why the most urgent conservation task is documenting knowledge, not only plants.',
                'content': (
                    'A plant population can recover. A recipe that was never written down cannot.\n\n'
                    '## Two different losses\n\n'
                    'Conservation biology tends to count species. But in traditional medicine the scarce resource is often '
                    'the know-how: which part to harvest, at what season, with what preparation, and at what dose. '
                    'HerbaCam tracks this as a documentation risk score, built from contributor numbers, the recency of '
                    'contributions and the geographic spread of what is recorded.\n\n'
                    '## What a high score means\n\n'
                    'A high documentation-risk score does not mean a plant is endangered. It means that what is known '
                    'about it rests on very few people, in very few places, with little recent activity — and is '
                    'therefore the most urgent candidate for outreach.\n\n'
                    '*This article is sample content for demonstration purposes.*'
                ),
                'published': True,
                'days_ago': 45,
            },
            {
                'title': 'Decoctions, Infusions, and Poultices',
                'slug': 'preparation-methods-guide',
                'category': 'preparation',
                'summary': 'The five preparation families behind most Cameroonian remedies.',
                'content': (
                    'Most traditional preparations fall into a small number of families, and the family tells you '
                    'something about the plant material being used.\n\n'
                    '## Decoction (boiling)\n\n'
                    'Used for hard material — bark, roots, seeds — where heat and time are needed to extract '
                    'compounds. Typically simmered for 15–30 minutes.\n\n'
                    '## Infusion (steeping)\n\n'
                    'Used for leaves and flowers, where prolonged boiling would destroy volatile compounds. Hot water is '
                    'poured over the material and left to steep.\n\n'
                    '## Poultice\n\n'
                    'Fresh material crushed and applied directly, most often for wounds, burns and skin complaints.\n\n'
                    '## Powder\n\n'
                    'Dried material ground to a powder, allowing storage and measured dosing.\n\n'
                    '## Medicinal bath\n\n'
                    'A preparation added to bathing water, common for fever and skin conditions, especially for children.\n\n'
                    '*This article is sample content for demonstration purposes.*'
                ),
                'published': True,
                'days_ago': 38,
            },
            {
                'title': 'Reading a Safety Record',
                'slug': 'reading-a-safety-record',
                'category': 'safety-and-evidence',
                'summary': 'What risk levels, pregnancy warnings, and dosage concerns actually tell you.',
                'content': (
                    'Every plant page in HerbaCam carries a safety record when one has been documented. Here is how to '
                    'read it.\n\n'
                    '## Risk level\n\n'
                    'Risk level describes how cautiously the material must be handled, not how toxic it is in the '
                    'abstract. Rauvolfia vomitoria is rated high because its alkaloids have a narrow therapeutic window, '
                    'not because it is never used.\n\n'
                    '## The two flags\n\n'
                    'Pregnancy and children warnings are treated separately because they change advice '
                    'disproportionately. A plant that is safe for an adult can be inappropriate in pregnancy.\n\n'
                    '## Dosage concerns\n\n'
                    'This is where practitioners record what they know about quantity and duration — the part of '
                    'traditional knowledge that is most often lost first.\n\n'
                    '*This article is sample content for demonstration purposes.*'
                ),
                'published': True,
                'days_ago': 31,
            },
            {
                'title': 'Kola Nut and Bitter Kola: Ceremony and Stimulant',
                'slug': 'kola-nut-and-bitter-kola',
                'category': 'plant-profiles',
                'summary': 'Two different trees, one shared role in hospitality and social life.',
                'content': (
                    'Cola acuminata and Garcinia kola are unrelated trees whose seeds are routinely confused in markets '
                    'and conversation.\n\n'
                    '## Kola nut (Cola acuminata)\n\n'
                    'The caffeine-rich seed is presented to guests across the forest zone, often before any business is '
                    'discussed. Medicinally it appears in remedies for fatigue, headache and appetite loss — all '
                    'consistent with its stimulant content.\n\n'
                    '## Bitter kola (Garcinia kola)\n\n'
                    'Chewed socially in much the same way, but belonging to a different family entirely. Its biflavonoid '
                    'complex, kolaviron, has been studied for antioxidant and hepatoprotective activity.\n\n'
                    '## Keeping them apart\n\n'
                    'Confusing the two matters: they have different safety profiles and different documented uses. '
                    'Recording a local name alongside the scientific name is what prevents the confusion.\n\n'
                    '*This article is sample content for demonstration purposes.*'
                ),
                'published': True,
                'days_ago': 24,
            },
            {
                'title': 'Harvesting Bark Without Killing the Tree',
                'slug': 'harvesting-bark-sustainably',
                'category': 'conservation',
                'summary': 'Why Prunus africana became a cautionary tale for Cameroonian highland communities.',
                'content': (
                    'Prunus africana bark regenerates slowly. Ring-barking a mature tree to harvest its entire trunk '
                    'kills it, and demand for the bark has made this a conservation emergency in the Cameroonian '
                    'highlands.\n\n'
                    '## What sustainable practice looks like\n\n'
                    'Practitioners who harvest sustainably take vertical strips from opposite sides of the trunk rather '
                    'than a full ring, rotate trees, and leave young trees alone. These rules are social as much as '
                    'technical — enforced by community norms, not by inspectors.\n\n'
                    '## Why it belongs in the record\n\n'
                    'When HerbaCam records a bark use, the harvesting context is part of the knowledge. A remedy that '
                    'destroys its own source is not knowledge that can be passed on.\n\n'
                    '*This article is sample content for demonstration purposes.*'
                ),
                'published': True,
                'days_ago': 17,
            },
            {
                'title': 'A Healer’s Notebook: Notes from the Northwest Highlands',
                'slug': 'healers-notebook-northwest',
                'category': 'community',
                'summary': 'What forty years of practice looks like when it is finally written down.',
                'content': (
                    'Practitioners in the Northwest highlands work across two pharmacopoeias at once: the montane forest '
                    'species of the slopes and the garden herbs planted beside every house.\n\n'
                    '## The garden comes first\n\n'
                    'Scent leaf, lemongrass and bitter leaf handle most household complaints. Forest species — bark and '
                    'root material — are reserved for cases that do not settle, in part because they are harder to '
                    'source.\n\n'
                    '## Why write it down\n\n'
                    'Several contributors to this platform have described the same motivation: their grandparents knew '
                    'plants they were never taught. Documentation is a way of stopping that slow loss.\n\n'
                    '*This article is sample content for demonstration purposes.*'
                ),
                'published': True,
                'days_ago': 12,
            },
            {
                'title': 'Fever Plants of the Northern Savanna',
                'slug': 'fever-plants-northern-savanna',
                'category': 'plant-profiles',
                'summary': 'Neem, mahogany, and African peach in the Sahelian and Sudanian zones.',
                'content': (
                    'In the North, Adamawa and Far North regions, the pharmacopoeia is shaped by a long dry season. '
                    'Trees that keep their leaves through drought are the ones that carry the medicine.\n\n'
                    '## Neem (Azadirachta indica)\n\n'
                    'Planted deliberately beside compounds precisely so that leaves are available when fever season '
                    'arrives. Leaf decoction is the standard household preparation.\n\n'
                    '## African mahogany (Khaya senegalensis)\n\n'
                    'Bitter bark sold in market bundles, often alongside neem. Treat as a strong preparation with short '
                    'courses.\n\n'
                    '## African peach (Nauclea latifolia)\n\n'
                    'Root and bark preparations used for fever and intestinal complaints across the savanna belt.\n\n'
                    '*This article is sample content for demonstration purposes.*'
                ),
                'published': True,
                'days_ago': 9,
            },
            {
                'title': 'How the Review Workflow Protects Knowledge',
                'slug': 'how-review-workflow-protects-knowledge',
                'category': 'traditional-medicine',
                'summary': 'Why a submission passes through draft, review, and publication instead of going straight online.',
                'content': (
                    'A practitioner submission on HerbaCam is not published the moment it is submitted. It moves through '
                    'a workflow designed to protect both contributors and readers.\n\n'
                    '## The stages\n\n'
                    'A contributor can save a **draft** while gathering information. **Submitted** records wait for an '
                    'expert, who may **request corrections** or **reject** with a stated reason. Only **approved** '
                    'contributions are **published** into the public knowledge base.\n\n'
                    '## Why not publish immediately?\n\n'
                    'Because correction after publication is far harder than correction before it. Once a record is '
                    'public, changing it silently would make the platform untrustworthy; instead, corrections go through '
                    'a fresh review.\n\n'
                    '*This article is sample content for demonstration purposes.*'
                ),
                'published': True,
                'days_ago': 5,
            },
            {
                'title': 'Plants That Stop Bleeding: First Aid in the Forest Belt',
                'slug': 'plants-that-stop-bleeding',
                'category': 'plant-profiles',
                'summary': 'Chromolaena, Ageratum, and the roadside plants used on cuts.',
                'content': (
                    'Two of the most accessible first-aid plants in southern Cameroon are also two of the most '
                    'unimposing: both grow along roadsides and in fallow fields.\n\n'
                    '## Siam weed (Chromolaena odorata)\n\n'
                    'Leaf juice squeezed directly onto a cut is widely reported to slow bleeding. It is one of the '
                    'better-studied traditional wound plants in the region.\n\n'
                    '## Billy goat weed (Ageratum conyzoides)\n\n'
                    'Crushed leaves pressed onto a wound serve the same purpose in the highlands. Note that internal use '
                    'is discouraged because of pyrrolizidine alkaloids.\n\n'
                    '## External only\n\n'
                    'Both plants are documented for external use. Cleaning a wound properly and seeking care for deep '
                    'injuries matters more than which leaf is applied.\n\n'
                    '*This article is sample content for demonstration purposes.*'
                ),
                'published': True,
                'days_ago': 3,
            },
            {
                'title': 'Documenting a Contribution: A Practitioner’s Checklist',
                'slug': 'documenting-a-contribution-checklist',
                'category': 'traditional-medicine',
                'summary': 'The six pieces of information that make a submission reviewable.',
                'content': (
                    'A submission that can be reviewed quickly is a submission that becomes public knowledge quickly. '
                    'These are the fields that matter most.\n\n'
                    '1. **The plant** — scientific name if known, or the proposed name and local name.\n'
                    '2. **The language** — a local name without its language is hard to verify.\n'
                    '3. **The part used** — leaf, root, bark, seed. This changes both the preparation and the safety '
                    'profile.\n'
                    '4. **The preparation** — how it is made, not just what it treats.\n'
                    '5. **The place** — region and community, because knowledge is local.\n'
                    '6. **The context** — anything cultural, ceremonial, or seasonal about the use.\n\n'
                    '*This article is sample content for demonstration purposes.*'
                ),
                'published': True,
                'days_ago': 1,
            },
            {
                'title': 'Draft: Medicinal Plants of the Coastal Mangroves',
                'slug': 'coastal-mangrove-medicinal-plants-draft',
                'category': 'conservation',
                'summary': 'An unfinished survey of Littoral mangrove species and their traditional uses.',
                'content': (
                    'Field notes from the Wouri estuary, still being reviewed before publication.\n\n'
                    '## Open questions\n\n'
                    'Which mangrove species are actually used medicinally, as opposed to being collected for fuel and '
                    'construction? Preliminary interviews suggest that medicinal use of true mangroves is limited, and '
                    'that most "mangrove remedies" recorded to date actually involve back-mangrove and coastal forest '
                    'species.\n\n'
                    '## Next steps\n\n'
                    'Two further interview rounds are planned with fishing communities before this article is published.\n\n'
                    '*This draft is sample content and is not published.*'
                ),
                'published': False,
                'days_ago': 2,
            },
        ]

        created = 0
        for index, data in enumerate(articles):
            author = (experts + admins)[index % len(experts + admins)]
            published_at = now - timedelta(days=data['days_ago'])
            article, was_created = Article.objects.get_or_create(
                slug=data['slug'],
                defaults={
                    'title': data['title'],
                    'summary': data['summary'],
                    'content': data['content'],
                    'category': categories[data['category']],
                    'author': author,
                    'is_published': data['published'],
                    'published_at': published_at if data['published'] else None,
                },
            )
            if was_created:
                created += 1
                artwork = read_artwork(PLANT_ARTWORK[index % len(PLANT_ARTWORK)])
                if artwork:
                    article.cover_image.save(f'article-{data["slug"]}.jpg', ContentFile(artwork), save=True)
                self._stamp(article, 'created_at', published_at)
        return created

    # -------------------------------------------------------------- submissions

    SUBMISSIONS = [
        # contributor, status, plant (or None), proposed names, symptom, part, prep, region, community, description, context, reviewer, comments, reason
        ('mbaforc', 'PUBLISHED', 'Prunus africana', '', '', 'Hypertension', 'BARK', 'DECOCTION', 'Northwest', 'Bambui (Mezam)',
         'Bark decoction taken in small cups over three days for blood pressure complaints in older men.',
         'Harvested in vertical strips so the tree survives.', 'drnkeng', 'Matches three independently documented accounts from the same division.', ''),
        ('mbaforc', 'PUBLISHED', 'Ocimum gratissimum', '', '', 'Cough', 'LEAF', 'INFUSION', 'Northwest', 'Bali (Mezam)',
         'Warm leaf infusion taken morning and evening for cough, sometimes with a little honey.',
         'Scent leaf is planted at the kitchen door specifically for this use.', 'dretoundi', 'Consistent with household practice across the highlands.', ''),
        ('mbaforc', 'SUBMITTED', 'Ageratum conyzoides', '', '', 'Wounds', 'LEAF', 'POULTICE', 'Northwest', 'Wum (Menchum)',
         'Fresh leaves crushed in the palm and pressed onto cuts to stop bleeding while walking in the farm.',
         'Described as something everyone learns as a child.', '', '', ''),
        ('mbaforc', 'UNDER_REVIEW', None, 'Ficus exasperata', 'Sandpaper tree', 'Skin rash', 'LEAF', 'POULTICE', 'Northwest', 'Nkambe (Donga-Mantung)',
         'Rough leaves rubbed gently on itchy skin eruptions, then washed off after ten minutes.',
         'The roughness itself is said to be part of the treatment.', '', '', ''),
        ('mbaforc', 'REVISION_REQUESTED', 'Vernonia amygdalina', '', '', 'Malaria', 'LEAF', 'JUICE', 'Northwest', 'Kumbo (Bui)',
         'Fresh leaf juice taken in the morning for fever.',
         '', 'drnkeng', 'Please state the quantity of juice and how many days the preparation is taken.', 'Dosage and duration are missing.'),
        ('mbaforc', 'REJECTED', None, 'Unknown climber', 'Nkang', 'Snake bite', 'LEAF', 'OTHER', 'Northwest', '',
         'Leaves are chewed after a snake bite.',
         '', 'drnkeng', 'Cannot be verified without the plant identified, and snake bite requires urgent medical referral.', 'No plant identification and unsafe advice.'),
        ('mbaforc', 'DRAFT', 'Zingiber officinale', '', '', 'Nausea', 'TUBER', 'INFUSION', 'Northwest', '',
         'Ginger infusion for nausea — still confirming whether honey is added.',
         '', '', '', ''),

        ('talla_e', 'PUBLISHED', 'Alstonia boonei', '', '', 'Malaria', 'BARK', 'DECOCTION', 'East', 'Abong-Mbang (Haut-Nyong)',
         'Bark decoction taken twice daily for three days for malaria-like fever.',
         'The most frequently cited anti-malarial preparation in this division.', 'dretoundi', 'Well documented across the forest zone.', ''),
        ('talla_e', 'PUBLISHED', 'Enantia chlorantha', '', '', 'Fever', 'BARK', 'DECOCTION', 'East', 'Bertoua (Lom-et-Djérem)',
         'Yellow bark boiled to a bitter decoction and taken in small doses for intermittent fever.',
         'Bark is traded dried in the market.', 'drnkeng', 'Consistent with records from the Centre region.', ''),
        ('talla_e', 'SUBMITTED', 'Voacanga africana', '', '', 'Rheumatism', 'BARK', 'DECOCTION', 'East', 'Batouri (Kadey)',
         'Small quantities of bark decoction used for joint pain in older patients.',
         'Only used by healers with long experience.', '', '', ''),
        ('talla_e', 'REVISION_REQUESTED', 'Picralima nitida', '', '', 'Headache', 'SEED', 'POWDER', 'East', 'Yokadouma (Boumba-et-Ngoko)',
         'Seed powder taken for severe headache.',
         '', 'profeyong', 'Please add how much seed powder is used and how often.', 'Quantity and frequency must be stated for a potent seed.'),
        ('talla_e', 'DRAFT', 'Annona muricata', '', '', 'Insomnia', 'LEAF', 'INFUSION', 'East', '',
         'Evening leaf infusion to help sleep — collecting more detail on duration.',
         '', '', '', ''),

        ('njikam_a', 'PUBLISHED', 'Nauclea latifolia', '', '', 'Dysentery', 'BARK', 'DECOCTION', 'Adamawa', 'Ngaoundéré II (Vina)',
         'Bark decoction taken for two days for bloody diarrhea.',
         'Used when the patient is far from a health centre.', 'profeyong', 'Documented widely across the savanna belt.', ''),
        ('njikam_a', 'PUBLISHED', 'Tetrapleura tetraptera', '', '', 'Menstrual pain', 'FRUIT', 'DECOCTION', 'Adamawa', 'Meiganga (Mbere)',
         'Fruit boiled and the decoction given to women after childbirth for several days.',
         'A standard element of post-partum care here.', 'dretoundi', 'Consistent with records from the forest zone.', ''),
        ('njikam_a', 'UNDER_REVIEW', 'Moringa oleifera', '', '', 'Anaemia', 'LEAF', 'POWDER', 'Adamawa', 'Tignère (Faro-et-Déo)',
         'Dried leaf powder stirred into porridge for women recovering from childbirth.',
         '', '', '', ''),
        ('njikam_a', 'SUBMITTED', None, 'Hibiscus asper', 'Foléré', 'Fatigue', 'LEAF', 'DECOCTION', 'Adamawa', 'Banyo (Mayo-Banyo)',
         'Leaf decoction taken as a strengthening tonic after illness.',
         'Also eaten as a vegetable.', '', '', ''),
        ('njikam_a', 'APPROVED', 'Khaya senegalensis', '', '', 'Malaria', 'BARK', 'DECOCTION', 'Adamawa', 'Ngaoundal (Djerem)',
         'Bitter bark decoction taken for fever, in short courses only.',
         'Market-bought bark is checked for freshness before use.', 'drnkeng', 'Approved with the short-course caution included.', ''),
        ('njikam_a', 'REJECTED', 'Securidaca longipedunculata', '', '', 'Rheumatism', 'ROOT', 'POWDER', 'Adamawa', '',
         'Root powder taken for joint pain.',
         '', 'profeyong', 'Root preparations of this species are documented as toxic at high doses and the submission gives no quantity.', 'Safety: no dosing information for a toxic root.'),

        ('awah_p', 'PUBLISHED', 'Chromolaena odorata', '', '', 'Wounds', 'LEAF', 'JUICE', 'Southwest', 'Buea Town (Fako)',
         'Leaf juice squeezed directly onto a clean cut to stop bleeding before dressing it.',
         'Everyone in the village knows this one.', 'drnkeng', 'Consistent with published wound-healing literature.', ''),
        ('awah_p', 'PUBLISHED', 'Senna alata', '', '', 'Skin rash', 'LEAF', 'POULTICE', 'Southwest', 'Tiko (Fako)',
         'Crushed leaves rubbed onto ringworm patches twice a day until the patch clears.',
         'Usually the first thing tried for childhood ringworm.', 'profeyong', 'Supported by antifungal studies.', ''),
        ('awah_p', 'SUBMITTED', 'Prunus africana', '', '', 'Prostate complaints', 'BARK', 'DECOCTION', 'Southwest', 'Bangem (Kupe-Manengouba)',
         'Bark decoction taken for urinary difficulty in older men.',
         'Harvesting follows community rules on Mount Cameroon.', '', '', ''),
        ('awah_p', 'UNDER_REVIEW', 'Piper guineense', '', '', 'Cough', 'SEED', 'POWDER', 'Southwest', 'Kumba (Meme)',
         'Ground seeds mixed with honey and taken for a persistent cough.',
         '', '', '', ''),
        ('awah_p', 'REVISION_REQUESTED', 'Carica papaya', '', '', 'Malaria', 'LEAF', 'DECOCTION', 'Southwest', 'Mamfe (Manyu)',
         'Leaf decoction taken during fever.',
         '', 'dretoundi', 'Please add whether the leaves are fresh or dried, and the approximate quantity of water.', 'Preparation details are incomplete.'),

        ('bongfen_r', 'PUBLISHED', 'Garcinia kola', '', '', 'Cough', 'SEED', 'RAW', 'South', 'Sangmélima (Dja-et-Lobo)',
         'Bitter kola chewed slowly for cough and throat irritation.',
         'Offered to guests alongside kola nut.', 'dretoundi', 'Consistent with records from the Centre region.', ''),
        ('bongfen_r', 'PUBLISHED', 'Xylopia aethiopica', '', '', 'Menstrual pain', 'FRUIT', 'POWDER', 'South', 'Ebolowa (Mvila)',
         'Dried fruit powdered and taken in warm water after childbirth.',
         '', 'profeyong', 'Well documented post-partum use.', ''),
        ('bongfen_r', 'SUBMITTED', 'Zanthoxylum gilletii', '', '', 'Toothache', 'BARK', 'RAW', 'South', 'Djoum (Dja-et-Lobo)',
         'A piece of bark is chewed on the painful side until the mouth goes numb.',
         '', '', '', ''),
        ('bongfen_r', 'UNDER_REVIEW', None, 'Pentaclethra macrophylla', 'Ebaye', 'Ulcers', 'BARK', 'DECOCTION', 'South', 'Ambam (Vallée-du-Ntem)',
         'Bark decoction taken for stomach ulcer pain.',
         'The seeds are more widely eaten than the bark is used.', '', '', ''),
        ('bongfen_r', 'DRAFT', 'Annona muricata', '', '', 'Fatigue', 'LEAF', 'INFUSION', 'South', '',
         'Leaf infusion as a restorative drink — checking how long it is usually taken.',
         '', '', '', ''),
        ('bongfen_r', 'APPROVED', 'Alstonia boonei', '', '', 'Fever', 'LEAF', 'INFUSION', 'South', 'Kribi (Océan)',
         'Leaf infusion taken to bring down fever while waiting to reach a clinic.',
         '', 'drnkeng', 'Approved; the referral advice was retained in the record.', ''),
    ]

    def _submissions(self, plants, symptoms, regions, communities, users):
        now = timezone.now()
        created = 0
        for index, row in enumerate(self.SUBMISSIONS):
            (contributor_key, status, plant_key, proposed_scientific, proposed_common, symptom_name,
             part, prep, region_name, community_label, description, context, reviewer_key,
             comments, reason) = row

            contributor = users.get(contributor_key)
            plant = plants.get(plant_key)
            symptom = symptoms.get(symptom_name)
            region = regions.get(region_name)
            community = communities.get(community_label)

            submitted_at = now - timedelta(days=RANDOM.randint(5, 240))
            review_date = submitted_at + timedelta(days=RANDOM.randint(2, 12)) if reviewer_key else None

            defaults = {
                'proposed_scientific_name': proposed_scientific,
                'proposed_common_name': proposed_common,
                'local_name': '',
                'language': '',
                'plant_part': part,
                'preparation_method': prep,
                'traditional_use_description': description,
                'cultural_context': context,
                'community_name': community.name if community else (community_label or ''),
                'supporting_information': 'Submitted through the HerbaCam practitioner portal (demo dataset).',
            }

            lookup = {
                'contributor': contributor,
                'traditional_use_description': description,
            }
            submission, was_created = KnowledgeSubmission.objects.get_or_create(
                **lookup, defaults=defaults
            )
            if was_created:
                created += 1

            submission.plant = plant
            submission.symptom = symptom
            submission.region = region
            submission.community = community
            submission.status = status
            submission.review_comments = comments
            submission.review_reason = reason
            submission.reviewer = users.get(reviewer_key) if reviewer_key else None
            submission.review_date = review_date
            submission.submitted_at = None if status == 'DRAFT' else submitted_at
            submission.save()

            if was_created:
                self._stamp(submission, 'created_at', submitted_at)
        return created

    # ----------------------------------------------------------- identifications

    def _identifications(self, plants, users):
        now = timezone.now()
        regulars = [u for u in users.values() if u.role == User.Role.USER]
        practitioners = [u for u in users.values() if u.role == User.Role.PRACTITIONER]
        pool = regulars + practitioners
        plant_list = list(plants.values())

        created = 0
        for index in range(42):
            user = pool[index % len(pool)]
            plant = plant_list[index % len(plant_list)]
            artwork_name = PLANT_ARTWORK[index % len(PLANT_ARTWORK)]
            data = read_artwork(artwork_name)
            if not data:
                continue

            when = now - timedelta(days=RANDOM.randint(0, 120), hours=RANDOM.randint(0, 23))
            status = 'FAILED' if index % 11 == 5 else ('PENDING' if index % 17 == 7 else 'COMPLETED')

            identification = Identification.objects.create(
                user=user,
                status='PROCESSING',
            )
            identification.image.save(f'seed-{identification.pk}.jpg', ContentFile(data), save=True)

            if status == 'COMPLETED':
                confidence = round(RANDOM.uniform(0.52, 0.97), 2)
                IdentificationResult.objects.create(
                    identification=identification,
                    plant=plant,
                    scientific_name=plant.scientific_name,
                    common_name=plant.common_name,
                    confidence=confidence,
                    is_primary=True,
                    ai_raw_response={'mode': 'demo', 'note': 'Seeded demo identification'},
                )
                for alt_plant in RANDOM.sample(plant_list, k=2):
                    if alt_plant.pk == plant.pk:
                        continue
                    IdentificationResult.objects.create(
                        identification=identification,
                        plant=alt_plant,
                        scientific_name=alt_plant.scientific_name,
                        common_name=alt_plant.common_name,
                        confidence=round(RANDOM.uniform(0.08, confidence - 0.05 if confidence > 0.15 else 0.1), 2),
                        is_primary=False,
                    )
                identification.status = 'COMPLETED'
                identification.save()
            else:
                identification.status = status
                identification.save()

            self._stamp(identification, 'created_at', when)
            created += 1
        return created

    # --------------------------------------------------------------- favourites

    def _favorites(self, plants, users):
        regulars = [u for u in users.values() if u.role == User.Role.USER]
        plant_list = list(plants.values())
        now = timezone.now()
        created = 0
        for user in regulars:
            for plant in RANDOM.sample(plant_list, k=RANDOM.randint(4, 9)):
                favorite, was_created = Favorite.objects.get_or_create(user=user, plant=plant)
                if was_created:
                    created += 1
                    self._stamp(favorite, 'created_at', now - timedelta(days=RANDOM.randint(1, 150)))
        return created

    # ------------------------------------------------------------ notifications

    def _notifications(self, users):
        now = timezone.now()
        created = 0
        experts = [u for u in users.values() if u.role == User.Role.EXPERT]
        admins = [u for u in users.values() if u.role == User.Role.ADMIN]
        practitioners = [u for u in users.values() if u.role == User.Role.PRACTITIONER]
        regulars = [u for u in users.values() if u.role == User.Role.USER]

        for user in practitioners:
            submissions = KnowledgeSubmission.objects.filter(contributor=user)
            for submission in submissions:
                if submission.status == 'PUBLISHED':
                    notification, was_created = Notification.objects.get_or_create(
                        user=user, type='SUBMISSION_APPROVED',
                        title=f'Submission #{submission.pk} approved',
                        defaults={
                            'message': f'Your knowledge submission #{submission.pk} was approved and published.',
                            'related_object_type': 'KnowledgeSubmission',
                            'related_object_id': submission.pk,
                            'is_read': True,
                        },
                    )
                    if was_created:
                        created += 1
                        self._stamp(notification, 'created_at', submission.review_date or (now - timedelta(days=30)))
                elif submission.status == 'REJECTED':
                    notification, was_created = Notification.objects.get_or_create(
                        user=user, type='SUBMISSION_REJECTED',
                        title=f'Submission #{submission.pk} rejected',
                        defaults={
                            'message': f'Your submission #{submission.pk} was rejected: {submission.review_reason}',
                            'related_object_type': 'KnowledgeSubmission',
                            'related_object_id': submission.pk,
                            'is_read': False,
                        },
                    )
                    if was_created:
                        created += 1
                        self._stamp(notification, 'created_at', submission.review_date or (now - timedelta(days=20)))
                elif submission.status == 'REVISION_REQUESTED':
                    notification, was_created = Notification.objects.get_or_create(
                        user=user, type='SUBMISSION_REVISION',
                        title='Revision Requested',
                        defaults={
                            'message': f'Your submission #{submission.pk} needs revision: {submission.review_reason}',
                            'related_object_type': 'KnowledgeSubmission',
                            'related_object_id': submission.pk,
                            'is_read': False,
                        },
                    )
                    if was_created:
                        created += 1
                        self._stamp(notification, 'created_at', submission.review_date or (now - timedelta(days=10)))

        pending = KnowledgeSubmission.objects.filter(status__in=['SUBMITTED', 'UNDER_REVIEW'])
        for reviewer in experts + admins:
            for submission in pending[:6]:
                notification, was_created = Notification.objects.get_or_create(
                    user=reviewer, type='NEW_REVIEW',
                    title=f'Submission #{submission.pk} needs review',
                    defaults={
                        'message': f'Knowledge submission #{submission.pk} is awaiting review.',
                        'related_object_type': 'KnowledgeSubmission',
                        'related_object_id': submission.pk,
                        'is_read': RANDOM.random() > 0.7,
                    },
                )
                if was_created:
                    created += 1
                    self._stamp(notification, 'created_at', submission.submitted_at or (now - timedelta(days=5)))

        recent = Identification.objects.filter(status='COMPLETED')[:24]
        for identification in recent:
            primary = identification.results.filter(is_primary=True).first()
            notification, was_created = Notification.objects.get_or_create(
                user=identification.user, type='IDENTIFICATION_READY',
                title=f'Identification #{identification.id} complete',
                defaults={
                    'message': f'Your image was identified as {primary.scientific_name if primary else "a plant"} '
                               f'({int((primary.confidence or 0) * 100)}% confidence).',
                    'related_object_type': 'Identification',
                    'related_object_id': identification.id,
                    'is_read': RANDOM.random() > 0.5,
                },
            )
            if was_created:
                created += 1
                self._stamp(notification, 'created_at', identification.created_at + timedelta(minutes=2))

        system_messages = [
            ('Welcome to HerbaCam', 'Thanks for joining. Start by browsing the plant library or trying an identification.'),
            ('New articles published', 'Three new articles about preparation methods and safety are now available.'),
            ('Knowledge base updated', 'Newly verified traditional uses were published this week.'),
            ('Reminder: document local names', 'Adding the language of a local name helps experts verify submissions faster.'),
        ]
        for user in regulars + practitioners:
            title, message = RANDOM.choice(system_messages)
            notification, was_created = Notification.objects.get_or_create(
                user=user, type='SYSTEM', title=title,
                defaults={'message': message, 'is_read': RANDOM.random() > 0.6},
            )
            if was_created:
                created += 1
                self._stamp(notification, 'created_at', now - timedelta(days=RANDOM.randint(1, 60)))
        return created

    # -------------------------------------------------------------------- risk

    def _risk(self):
        from preservation.services import run_full_risk_assessment

        results = run_full_risk_assessment()
        now = timezone.now()
        offset = 0
        for assessment in list(results['plants']) + list(results['regions']):
            offset = (offset + 7) % 30
            self._stamp(assessment, 'calculated_at', now - timedelta(days=offset))
        return len(results['plants']) + len(results['regions'])

    # ------------------------------------------------------------------- audit

    def _audit(self, users):
        now = timezone.now()
        created = 0
        admins = [u for u in users.values() if u.role == User.Role.ADMIN]
        experts = [u for u in users.values() if u.role == User.Role.EXPERT]
        practitioners = [u for u in users.values() if u.role == User.Role.PRACTITIONER]
        regulars = [u for u in users.values() if u.role == User.Role.USER]

        for user in regulars + practitioners:
            self._log(user, 'USER_REGISTER', f'New user registered: {user.username}',
                      target_type='User', when=user.date_joined)
            created += 1

        for identification in Identification.objects.select_related('user')[:30]:
            primary = identification.results.filter(is_primary=True).first()
            self._log(identification.user, 'PLANT_IDENTIFICATION',
                      f'Identified {primary.scientific_name if primary else "unknown plant"} (demo mode)',
                      target_type='Identification', target_id=identification.id,
                      when=identification.created_at)
            created += 1

        for submission in KnowledgeSubmission.objects.select_related('contributor').exclude(status='DRAFT'):
            self._log(submission.contributor, 'KNOWLEDGE_SUBMIT',
                      f'Submitted knowledge: #{submission.pk}',
                      target_type='KnowledgeSubmission', target_id=submission.pk,
                      when=submission.submitted_at or submission.created_at)
            created += 1
            if submission.reviewer:
                action = {
                    'PUBLISHED': ('KNOWLEDGE_APPROVE', f'Approved submission #{submission.pk}'),
                    'APPROVED': ('KNOWLEDGE_APPROVE', f'Approved submission #{submission.pk}'),
                    'REJECTED': ('KNOWLEDGE_REJECT', f'Rejected submission #{submission.pk}: {submission.review_reason}'),
                    'REVISION_REQUESTED': ('KNOWLEDGE_REVISION', f'Requested revision for #{submission.pk}'),
                }.get(submission.status)
                if action:
                    self._log(submission.reviewer, action[0], action[1],
                              target_type='KnowledgeSubmission', target_id=submission.pk,
                              when=submission.review_date or submission.created_at)
                    created += 1

        for evidence in Evidence.objects.select_related('plant', 'reviewer')[:20]:
            self._log(evidence.reviewer, 'EVIDENCE_CREATE',
                      f'Created evidence for {evidence.plant.scientific_name}',
                      target_type='Evidence', target_id=evidence.id, when=evidence.created_at)
            created += 1

        for record in SafetyInformation.objects.select_related('plant', 'reviewer')[:20]:
            self._log(record.reviewer, 'SAFETY_CREATE',
                      f'Created safety record for {record.plant.scientific_name}',
                      target_type='SafetyInformation', target_id=record.id, when=record.created_at)
            created += 1

        for index, plant in enumerate(Plant.objects.all()[:12]):
            self._log(admins[index % len(admins)], 'PLANT_CREATE',
                      f'Created plant: {plant.scientific_name}',
                      target_type='Plant', target_id=plant.id,
                      when=now - timedelta(days=300 - index * 12))
            created += 1

        for index, user in enumerate(regulars):
            self._log(admins[index % len(admins)], 'USER_MANAGE',
                      f'Admin reviewed account: {user.username}',
                      target_type='User', target_id=user.id,
                      when=now - timedelta(days=RANDOM.randint(1, 90)))
            created += 1

        for expert in experts:
            self._log(expert, 'SYSTEM_SETTINGS_UPDATE', 'Updated system settings',
                      target_type='SystemSetting', when=now - timedelta(days=RANDOM.randint(1, 40)))
            created += 1
        return created

    # ----------------------------------------------------------------- settings

    def _settings(self, users):
        admin = users['admin']
        defaults = {
            'application': {'name': 'HerbaCam', 'support_email': 'support@herbacam.org', 'language': 'en'},
            'registration': {'enabled': True, 'require_email': True, 'default_role': 'USER'},
            'notifications': {'email': True, 'in_app': True, 'digest': 'weekly'},
            'content': {'moderation': True, 'require_review': True, 'public_plants': True},
            'ai': {'enabled': True, 'model': 'google/gemini-2.0-flash-exp:free', 'max_upload_mb': 10},
        }
        for key, value in defaults.items():
            SystemSetting.objects.update_or_create(
                key=key, defaults={'value': value, 'updated_by': admin}
            )

    # ------------------------------------------------------------------ handler

    def handle(self, *args, **options):
        self.stdout.write('Seeding database with demo data…')

        if options.get('clear'):
            self._clear()

        users = self._users()
        regions, divisions, communities = self._geography()
        methods = {}
        for name, description in [
            ('DECOCTION', 'Boiling plant material in water — used for bark, roots and seeds.'),
            ('INFUSION', 'Steeping plant material in hot water — used for leaves and flowers.'),
            ('POULTICE', 'Crushed plant material applied directly to the skin.'),
            ('POWDER', 'Dried and ground plant material, stored for measured use.'),
            ('JUICE', 'Fresh juice or extract squeezed from plant material.'),
            ('OINTMENT', 'Plant material blended into a fat or oil base for topical use.'),
            ('TINCTURE', 'Plant material macerated in alcohol or spirit.'),
            ('SMOKE', 'Plant material burned or heated so the smoke is inhaled.'),
            ('BATH', 'Preparation added to bathing water.'),
            ('RAW', 'Direct consumption of fresh plant material.'),
            ('OTHER', 'Any preparation that does not fit the categories above.'),
        ]:
            method, _ = PreparationMethod.objects.get_or_create(
                name=name, defaults={'description': description}
            )
            methods[name] = method

        symptoms = self._symptoms()
        plants = self._plants(regions)

        practitioners = [u for u in users.values() if u.role == User.Role.PRACTITIONER]
        profiles = [
            ('mbaforc', 'Northwest', 'Bambui', 25, 'Respiratory ailments, digestive health, skin conditions',
             'Trained from childhood by a grandmother who practised in the Mezam division.', True),
            ('talla_e', 'East', 'Abong-Mbang', 32, 'Malaria and febrile illness, bark preparations',
             'Apprenticed for twelve years to a healer in the Haut-Nyong forest zone.', True),
            ('njikam_a', 'Adamawa', 'Ngaoundéré II', 18, 'Women’s health, post-partum care, anaemia',
             'Learned through the women’s association of her community on the Adamawa plateau.', True),
            ('awah_p', 'Southwest', 'Buea Town', 21, 'Wound care, skin conditions, first aid',
             'Learned from a father who treated farm injuries around Mount Cameroon.', True),
            ('bongfen_r', 'South', 'Sangmélima', 40, 'Midwifery, child health, forest bark remedies',
             'Third-generation practitioner in the Dja-et-Lobo division.', False),
        ]
        for username, region_name, community, years, areas, training, verified in profiles:
            PractitionerProfile.objects.update_or_create(
                user=users[username],
                defaults={
                    'region': regions.get(region_name),
                    'community_name': community,
                    'years_of_experience': years,
                    'areas_of_knowledge': areas,
                    'traditional_training': training,
                    'is_verified': verified,
                },
            )

        uses = self._traditional_uses(plants, symptoms, regions, methods, users)
        evidence = self._evidence(plants, users)
        safety = self._safety(plants, users)
        articles = self._articles(users)
        submissions = self._submissions(plants, symptoms, regions, communities, users)
        identifications = self._identifications(plants, users)
        favorites = self._favorites(plants, users)
        notifications = self._notifications(users)
        risks = self._risk()
        audits = self._audit(users)
        self._settings(users)

        self.stdout.write(self.style.SUCCESS('Demo data seeded successfully!'))
        self.stdout.write('  Login: admin/admin123! · drnkeng/expert123! · mbaforc/pract123! · demo_user/user1234!')
        self.stdout.write(f'  Users:                 {User.objects.count()}')
        self.stdout.write(f'  Regions / communities: {Region.objects.count()} / {Community.objects.count()}')
        self.stdout.write(f'  Plants:                {Plant.objects.count()}')
        self.stdout.write(f'  Symptoms:              {Symptom.objects.count()}')
        self.stdout.write(f'  Traditional uses:      {TraditionalUse.objects.count()} (+{uses} new)')
        self.stdout.write(f'  Evidence records:      {Evidence.objects.count()} (+{evidence} new)')
        self.stdout.write(f'  Safety records:        {SafetyInformation.objects.count()} (+{safety} new)')
        self.stdout.write(f'  Articles:              {Article.objects.count()} (+{articles} new)')
        self.stdout.write(f'  Knowledge submissions: {KnowledgeSubmission.objects.count()} (+{submissions} new)')
        self.stdout.write(f'  Identifications:       {Identification.objects.count()} (+{identifications} new)')
        self.stdout.write(f'  Favorites:             {Favorite.objects.count()} (+{favorites} new)')
        self.stdout.write(f'  Notifications:         {Notification.objects.count()} (+{notifications} new)')
        self.stdout.write(f'  Risk assessments:      {RiskAssessment.objects.count()} ({risks} recalculated)')
        self.stdout.write(f'  Audit logs:            {AuditLog.objects.count()} (+{audits} new)')
        self.stdout.write(self.style.WARNING('  ⚠ All data is DEMO/SAMPLE data — not medical advice.'))
