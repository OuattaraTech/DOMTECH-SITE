// CHATBOT INTELLIGENT AUTONOME DOMTECH
// Système d'IA conversationnelle avancé avec MÉMOIRE PERSISTANTE

let chatbotOpen = false;
let currentClientId = null;
let conversationContext = {
    stage: 'greeting',
    userInfo: {},
    serviceInterest: null,
    lastIntent: null,
    conversationHistory: [],
    userPreferences: {},
    leadScore: 0,
    sessionStartTime: Date.now(),
    returningClient: false
};

// SYSTÈME DE MÉMOIRE PERSISTANTE
class ClientMemorySystem {
    constructor() {
        this.storageKey = 'domtech_client_memories';
        this.maxMemoryDays = 30; // Garde les conversations 30 jours
        this.maxConversationsPerClient = 10; // Max 10 conversations par client
    }

    // Génère un ID unique pour chaque client basé sur le navigateur
    generateClientId() {
        let clientId = localStorage.getItem('domtech_client_id');
        
        if (!clientId) {
            // Création d'un ID unique basé sur plusieurs facteurs
            const timestamp = Date.now();
            const random = Math.random().toString(36).substr(2, 9);
            const userAgent = navigator.userAgent.slice(-10);
            const screenRes = `${screen.width}x${screen.height}`;
            
            clientId = `domtech_${timestamp}_${random}_${btoa(userAgent + screenRes).slice(0, 8)}`;
            localStorage.setItem('domtech_client_id', clientId);
        }
        
        return clientId;
    }

    // Sauvegarde la conversation complète
    saveConversation(clientId, conversationData) {
        try {
            const memories = this.getAllMemories();
            
            if (!memories[clientId]) {
                memories[clientId] = {
                    firstVisit: Date.now(),
                    totalConversations: 0,
                    totalLeadScore: 0,
                    preferredServices: [],
                    conversations: []
                };
            }

            const clientMemory = memories[clientId];
            
            // Ajouter la nouvelle conversation
            const conversationSummary = {
                id: `conv_${Date.now()}`,
                timestamp: Date.now(),
                duration: Date.now() - conversationData.sessionStartTime,
                messageCount: conversationData.conversationHistory.length,
                leadScore: conversationData.leadScore,
                serviceInterest: conversationData.serviceInterest,
                lastIntent: conversationData.lastIntent,
                stage: conversationData.stage,
                keyTopics: this.extractKeyTopics(conversationData.conversationHistory),
                clientInfo: conversationData.userInfo,
                urgencyDetected: conversationData.conversationHistory.some(msg => 
                    msg.analysis && msg.analysis.urgencyLevel > 0
                ),
                summary: this.generateConversationSummary(conversationData)
            };

            clientMemory.conversations.unshift(conversationSummary);
            clientMemory.totalConversations++;
            clientMemory.totalLeadScore += conversationData.leadScore;
            
            // Mise à jour des services préférés
            if (conversationData.serviceInterest) {
                const serviceIndex = clientMemory.preferredServices.findIndex(s => s.service === conversationData.serviceInterest);
                if (serviceIndex >= 0) {
                    clientMemory.preferredServices[serviceIndex].count++;
                } else {
                    clientMemory.preferredServices.push({
                        service: conversationData.serviceInterest,
                        count: 1,
                        lastMentioned: Date.now()
                    });
                }
            }

            // Limiter le nombre de conversations stockées
            if (clientMemory.conversations.length > this.maxConversationsPerClient) {
                clientMemory.conversations = clientMemory.conversations.slice(0, this.maxConversationsPerClient);
            }

            // Sauvegarder
            localStorage.setItem(this.storageKey, JSON.stringify(memories));
            
            console.log(`💾 Conversation sauvegardée pour client ${clientId}`);
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde conversation:', error);
            return false;
        }
    }

    // Récupère la mémoire d'un client
    getClientMemory(clientId) {
        try {
            const memories = this.getAllMemories();
            return memories[clientId] || null;
        } catch (error) {
            console.error('❌ Erreur récupération mémoire:', error);
            return null;
        }
    }

    // Récupère toutes les mémoires
    getAllMemories() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('❌ Erreur lecture mémoires:', error);
            return {};
        }
    }

    // Nettoie les anciennes conversations
    cleanOldMemories() {
        try {
            const memories = this.getAllMemories();
            const cutoffDate = Date.now() - (this.maxMemoryDays * 24 * 60 * 60 * 1000);
            let cleaned = false;

            for (let clientId in memories) {
                const clientMemory = memories[clientId];
                const originalLength = clientMemory.conversations.length;
                
                clientMemory.conversations = clientMemory.conversations.filter(
                    conv => conv.timestamp > cutoffDate
                );

                if (clientMemory.conversations.length !== originalLength) {
                    cleaned = true;
                }

                // Supprimer les clients sans conversations récentes
                if (clientMemory.conversations.length === 0 && clientMemory.firstVisit < cutoffDate) {
                    delete memories[clientId];
                    cleaned = true;
                }
            }

            if (cleaned) {
                localStorage.setItem(this.storageKey, JSON.stringify(memories));
                console.log('🧹 Nettoyage des anciennes mémoires effectué');
            }
        } catch (error) {
            console.error('❌ Erreur nettoyage mémoires:', error);
        }
    }

    // Extrait les sujets clés d'une conversation
    extractKeyTopics(conversationHistory) {
        const topics = new Set();
        
        conversationHistory.forEach(msg => {
            if (msg.type === 'user') {
                const words = msg.message.toLowerCase().split(/[\s,!?.-]+/);
                
                // Mots-clés importants
                const keywords = ['prix', 'tarif', 'installation', 'dépannage', 'urgence', 'problème', 
                                'clim', 'climatisation', 'frigo', 'électricité', 'plomberie', 'rendez-vous'];
                
                words.forEach(word => {
                    if (keywords.includes(word) || word.length > 6) {
                        topics.add(word);
                    }
                });
            }
        });

        return Array.from(topics).slice(0, 10); // Max 10 topics
    }

    // Génère un résumé de conversation
    generateConversationSummary(conversationData) {
        const { conversationHistory, serviceInterest, leadScore, lastIntent } = conversationData;
        
        let summary = "Conversation ";
        
        if (serviceInterest) {
            summary += `sur ${serviceInterest}. `;
        }
        
        if (leadScore > 20) {
            summary += "Client très intéressé. ";
        } else if (leadScore > 10) {
            summary += "Client modérément intéressé. ";
        }
        
        if (lastIntent === 'urgency') {
            summary += "URGENCE détectée. ";
        } else if (lastIntent === 'appointment') {
            summary += "Demande de RDV. ";
        } else if (lastIntent === 'pricing') {
            summary += "Demande de tarifs. ";
        }

        const userMessages = conversationHistory.filter(msg => msg.type === 'user');
        summary += `${userMessages.length} messages échangés.`;

        return summary;
    }

    // Génère un message de bienvenue personnalisé
    generateWelcomeMessage(clientMemory) {
        if (!clientMemory) {
            return null; // Nouveau client
        }

        const { totalConversations, conversations, preferredServices } = clientMemory;
        const lastConversation = conversations[0];
        
        let welcomeMsg = "👋 Ravi de vous revoir chez DOMTECH !\n\n";
        
        // Référence à la dernière conversation
        if (lastConversation) {
            const daysSince = Math.floor((Date.now() - lastConversation.timestamp) / (24 * 60 * 60 * 1000));
            
            if (daysSince === 0) {
                welcomeMsg += "🕐 Nous avons parlé plus tôt aujourd'hui";
            } else if (daysSince === 1) {
                welcomeMsg += "🕐 Nous avons parlé hier";
            } else if (daysSince < 7) {
                welcomeMsg += `🕐 Nous avons parlé il y a ${daysSince} jours`;
            } else {
                welcomeMsg += "🕐 Cela fait un moment !";
            }
            
            if (lastConversation.serviceInterest) {
                welcomeMsg += ` de ${domtechKnowledge.services[lastConversation.serviceInterest]?.name || lastConversation.serviceInterest}`;
            }
            welcomeMsg += ".\n\n";
        }

        // Service préféré
        if (preferredServices.length > 0) {
            const topService = preferredServices.sort((a, b) => b.count - a.count)[0];
            const serviceName = domtechKnowledge.services[topService.service]?.name || topService.service;
            welcomeMsg += `🎯 Je vois que vous vous intéressez à ${serviceName}.\n\n`;
        }

        // Urgence précédente
        if (lastConversation && lastConversation.urgencyDetected) {
            welcomeMsg += "🚨 J'espère que votre problème urgent a été résolu !\n\n";
        }

        // Statistiques client
        if (totalConversations > 1) {
            welcomeMsg += `📊 C'est notre ${totalConversations}e conversation ensemble.\n\n`;
        }

        welcomeMsg += "💬 Comment puis-je vous aider aujourd'hui ?";
        
        return welcomeMsg;
    }

    // Récupère le contexte de la dernière conversation
    getLastConversationContext(clientMemory) {
        if (!clientMemory || clientMemory.conversations.length === 0) {
            return null;
        }

        const lastConv = clientMemory.conversations[0];
        
        return {
            serviceInterest: lastConv.serviceInterest,
            lastIntent: lastConv.lastIntent,
            leadScore: Math.floor(lastConv.leadScore * 0.5), // 50% du score précédent
            keyTopics: lastConv.keyTopics,
            urgencyHistory: lastConv.urgencyDetected,
            clientInfo: lastConv.clientInfo
        };
    }
}

// Instance globale du système de mémoire
const memorySystem = new ClientMemorySystem();

// Base de connaissances complète DOMTECH
const domtechKnowledge = {
    services: {
        'climatisation': {
            name: 'Climatisation Split',
            description: 'Installation, entretien et dépannage de climatiseurs split',
            prices: { installation: 20000, entretien: 10000, depannage: 15000, 'installation-entretien': 25000 },
            keywords: ['clim', 'climatisation', 'split', 'froid', 'refroidir', 'chaud', 'température'],
            commonProblems: ['ne refroidit pas', 'bruit', 'fuite eau', 'ne démarre pas'],
            tips: ['Nettoyez les filtres mensuellement', 'Température optimale: 24-26°C', 'Évitez les écarts de température']
        },
        'armoire': {
            name: 'Armoire Climatisation',
            description: 'Solutions industrielles pour entreprises et grands espaces',
            prices: { installation: 60000, entretien: 15000, depannage: 25000, 'installation-entretien': 70000 },
            keywords: ['armoire', 'industriel', 'entreprise', 'bureau', 'commercial', 'grande surface'],
            commonProblems: ['surchauffe', 'ventilation insuffisante', 'consommation élevée'],
            tips: ['Maintenance préventive trimestrielle', 'Vérifiez les filtres régulièrement']
        },
        'refrigeration': {
            name: 'Réfrigération',
            description: 'Dépannage congélateurs et réfrigérateurs',
            prices: { depannage: 20000, entretien: 12000, installation: 30000 },
            keywords: ['frigo', 'congélateur', 'réfrigérateur', 'conservation', 'froid', 'surgélation'],
            commonProblems: ['ne refroidit plus', 'givre excessif', 'bruit anormal', 'fuite'],
            tips: ['Dégivrage régulier', 'Ne surchargez pas', 'Vérifiez les joints']
        },
        'electricite': {
            name: 'Électricité Bâtiment',
            description: 'Installation électrique et mise aux normes',
            prices: { installation: 40000, depannage: 18000, 'mise-aux-normes': 50000 },
            keywords: ['électricité', 'électrique', 'installation', 'panne', 'courant', 'disjoncteur'],
            commonProblems: ['coupure courant', 'court-circuit', 'surcharge', 'prises défaillantes'],
            tips: ['Vérifiez vos disjoncteurs', 'Ne surchargez pas les prises', 'Faites vérifier annuellement']
        },
        'plomberie': {
            name: 'Plomberie & Gazinière',
            description: 'Plomberie générale et raccordement gaz',
            prices: { installation: 35000, depannage: 20000, raccordement: 25000 },
            keywords: ['plomberie', 'eau', 'fuite', 'gazinière', 'gaz', 'tuyau', 'robinet'],
            commonProblems: ['fuite eau', 'pression faible', 'odeur gaz', 'robinet cassé'],
            tips: ['Coupez l\'eau en cas de fuite', 'Vérifiez les joints', 'Détecteur de gaz recommandé']
        }
    },
    
    intents: {
        greeting: ['bonjour', 'salut', 'hello', 'bonsoir', 'hey', 'coucou'],
        pricing: ['prix', 'tarif', 'coût', 'combien', 'cher', 'devis', 'budget'],
        services: ['service', 'que faites', 'spécialité', 'domaine', 'proposez'],
        contact: ['contact', 'téléphone', 'appeler', 'joindre', 'numéro', 'email'],
        hours: ['horaire', 'ouvert', 'fermé', 'heure', 'quand', 'disponible'],
        location: ['où', 'adresse', 'localisation', 'situé', 'zone', 'quartier'],
        urgency: ['urgent', 'urgence', 'rapide', 'vite', 'maintenant', 'immédiat'],
        appointment: ['rendez-vous', 'rdv', 'rencontrer', 'venir', 'planifier'],
        problem: ['problème', 'panne', 'marche pas', 'cassé', 'défaut', 'dysfonction'],
        quality: ['qualité', 'garantie', 'professionnel', 'expérience', 'compétent'],
        comparison: ['concurrent', 'différence', 'pourquoi', 'avantage', 'mieux']
    },

    responses: {
        greeting: [
            "Bonjour ! Je suis l'assistant virtuel de DOMTECH 🔧\nSpécialiste du froid et de la climatisation depuis 5 ans !",
            "Salut ! Ravi de vous accueillir chez DOMTECH !\n🌟 Comment puis-je vous aider aujourd'hui ?",
            "Bonjour ! Amadou et l'équipe DOMTECH sont à votre service !"
        ],
        services_general: [
            "🔧 DOMTECH propose 5 services d'excellence :\n\n• ❄️ Climatisation Split\n• 🏢 Armoires Climatisation\n• 🧊 Réfrigération\n• ⚡ Électricité Bâtiment\n• 🔧 Plomberie & Gazinière\n\nQuel service vous intéresse le plus ?",
            "Nous sommes LES spécialistes du froid, de la climatisation et de l'énergie à Abidjan !\n\n🏆 Plus de 500 clients satisfaits\n⭐ 5 ans d'expérience\n🚀 Service 24/7\n\nQuel est votre besoin précis ?"
        ],
        contact_info: [
            "📞 Contactez DOMTECH :\n\n• 🔥 URGENCES 24/7 : 07 10 36 76 02\n• 📱 Standard : 05 05 95 70 61\n• 📧 Email : infodomtech225@gmail.com\n\n💬 Voulez-vous que je vous connecte directement via WhatsApp ?",
            "🚀 DOMTECH à votre service !\n\n📞 07 10 36 76 02 (Amadou - Fondateur)\n📞 05 05 95 70 61 (Équipe technique)\n\n⚡ Réponse garantie sous 30 minutes !"
        ],
        hours: [
            "🕐 Horaires DOMTECH :\n\n📅 Lundi-Vendredi : 8h00-18h00\n📅 Samedi : 9h00-13h00\n🚨 URGENCES : 24h/24 - 7j/7\n\n⏰ Besoin d'une intervention maintenant ?"
        ],
        location: [
            "📍 DOMTECH intervient dans TOUT Abidjan :\n\n🏙️ Zones couvertes :\n• Cocody • Plateau • Marcory\n• Yopougon • Adjamé • Treichville\n• Koumassi • Port-Bouët • Abobo\n\n🚗 Déplacement gratuit pour devis !\nDans quel quartier êtes-vous ?"
        ],
        quality_assurance: [
            "🏆 Pourquoi choisir DOMTECH ?\n\n✅ 5+ années d'expérience\n✅ 500+ clients satisfaits\n✅ Techniciens certifiés\n✅ Garantie sur tous travaux\n✅ Pièces d'origine uniquement\n✅ Devis gratuit\n✅ Service après-vente\n\n⭐ Note moyenne : 5/5 étoiles"
        ]
    },

    // Patterns de conversation avancés
    conversationPatterns: {
        leadQualification: [
            "Pour mieux vous conseiller, puis-je connaître :",
            "• Type de logement/local ?",
            "• Surface approximative ?",
            "• Budget envisagé ?"
        ],
        urgencyDetection: [
            "🚨 URGENCE DÉTECTÉE !",
            "Situation critique identifiée.",
            "Intervention immédiate nécessaire."
        ],
        satisfactionCheck: [
            "Mes réponses vous aident-elles ?",
            "Avez-vous d'autres questions ?",
            "Souhaitez-vous parler à un technicien ?"
        ]
    }
};

// Système de scoring des prospects
const leadScoringSystem = {
    updateScore: (action, value = 1) => {
        conversationContext.leadScore += value;
        
        // Actions qui augmentent le score
        const scoringActions = {
            'ask_price': 10,
            'ask_appointment': 15,
            'show_urgency': 20,
            'provide_details': 5,
            'ask_multiple_services': 8,
            'mention_budget': 12
        };
        
        if (scoringActions[action]) {
            conversationContext.leadScore += scoringActions[action];
        }
    },
    
    getLeadLevel: () => {
        const score = conversationContext.leadScore;
        if (score >= 30) return 'hot';
        if (score >= 15) return 'warm';
        return 'cold';
    }
};

// Traitement du langage naturel avancé
function analyzeMessage(message) {
    const words = message.toLowerCase().split(/[\s,!?.-]+/);
    let detectedIntents = [];
    let detectedServices = [];
    let urgencyLevel = 0;
    let sentiment = 'neutral';
    
    // Détection multi-intentions
    for (let intent in domtechKnowledge.intents) {
        const keywords = domtechKnowledge.intents[intent];
        const matches = words.filter(word => 
            keywords.some(keyword => 
                word.includes(keyword) || 
                keyword.includes(word) ||
                levenshteinDistance(word, keyword) <= 2
            )
        );
        
        if (matches.length > 0) {
            detectedIntents.push({intent, confidence: matches.length});
        }
    }
    
    // Détection de services multiples
    for (let service in domtechKnowledge.services) {
        const keywords = domtechKnowledge.services[service].keywords;
        const matches = words.filter(word => 
            keywords.some(keyword => 
                word.includes(keyword) || 
                keyword.includes(word)
            )
        );
        
        if (matches.length > 0) {
            detectedServices.push({service, confidence: matches.length});
        }
    }
    
    // Détection d'urgence
    const urgencyWords = ['urgent', 'vite', 'maintenant', 'immédiat', 'rapide', 'aujourd\'hui'];
    urgencyLevel = words.filter(word => urgencyWords.includes(word)).length;
    
    // Analyse de sentiment basique
    const positiveWords = ['bien', 'bon', 'excellent', 'parfait', 'merci', 'super'];
    const negativeWords = ['problème', 'panne', 'cassé', 'mauvais', 'nul', 'cher'];
    
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    if (positiveCount > negativeCount) sentiment = 'positive';
    else if (negativeCount > positiveCount) sentiment = 'negative';
    
    // Tri par confiance
    detectedIntents.sort((a, b) => b.confidence - a.confidence);
    detectedServices.sort((a, b) => b.confidence - a.confidence);
    
    return {
        intents: detectedIntents,
        services: detectedServices,
        urgencyLevel,
        sentiment,
        originalMessage: message
    };
}

// Distance de Levenshtein pour la similarité des mots
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// Générateur de réponses intelligentes avec contexte
function generateIntelligentResponse(userMessage, analysis) {
    const { intents, services, urgencyLevel, sentiment } = analysis;
    let response = "";
    let actions = [];
    let followUpQuestions = [];
    
    // Mise à jour du contexte et scoring
    if (services.length > 0) {
        conversationContext.serviceInterest = services[0].service;
        leadScoringSystem.updateScore('ask_service', services.length * 2);
    }
    
    if (intents.length > 0) {
        conversationContext.lastIntent = intents[0].intent;
    }
    
    // Gestion de l'urgence
    if (urgencyLevel > 0) {
        leadScoringSystem.updateScore('show_urgency', urgencyLevel * 5);
        response = "🚨 URGENCE DÉTECTÉE !\n\n";
        response += "Pour une intervention d'urgence IMMÉDIATE :\n";
        response += "📞 Appelez MAINTENANT : 07 10 36 76 02\n";
        response += "⚡ Amadou ou un technicien vous répond\n";
        response += "🚗 Intervention sous 30 minutes à Abidjan\n\n";
        actions.push('urgent_call_button', 'urgent_whatsapp_button');
        
        if (services.length > 0) {
            const service = domtechKnowledge.services[services[0].service];
            response += `💰 Dépannage ${service.name} : ${service.prices.depannage?.toLocaleString() || 'Sur devis'} FCFA\n`;
            response += "💳 Paiement après intervention\n";
        }
        
        return { response, actions, followUpQuestions };
    }
    
    // Traitement des intentions principales
    const primaryIntent = intents[0]?.intent;
    const primaryService = services[0]?.service;
    
    switch (primaryIntent) {
        case 'greeting':
            response = getRandomResponse(domtechKnowledge.responses.greeting);
            response += "\n\n🎯 Je peux vous aider avec :\n";
            response += "• 💰 Devis instantanés\n• 🔧 Conseils techniques\n• 📅 Prise de rendez-vous\n• 🚨 Urgences 24/7\n\n";
            response += "Quel est votre projet ?";
            conversationContext.stage = 'service_inquiry';
            break;
            
        case 'services':
            if (primaryService) {
                response = generateServiceResponse(primaryService);
                actions.push('quote_button', 'whatsapp_button');
                followUpQuestions = [
                    "Quelle est la surface à climatiser ?",
                    "Avez-vous déjà un équipement ?",
                    "Quel est votre budget ?"
                ];
            } else {
                response = getRandomResponse(domtechKnowledge.responses.services_general);
            }
            break;
            
        case 'pricing':
            leadScoringSystem.updateScore('ask_price');
            if (primaryService) {
                response = generatePricingResponse(primaryService);
                actions.push('calculator_button', 'quote_button');
            } else {
                response = generateGeneralPricingResponse();
                actions.push('calculator_button');
            }
            break;
            
        case 'contact':
            response = getRandomResponse(domtechKnowledge.responses.contact_info);
            actions.push('whatsapp_button', 'call_button');
            break;
            
        case 'hours':
            response = getRandomResponse(domtechKnowledge.responses.hours);
            if (isOutsideBusinessHours()) {
                response += "\n\n⏰ Nous sommes actuellement fermés, mais :\n";
                response += "• 📱 WhatsApp disponible 24/7\n";
                response += "• 🚨 Urgences : appelez quand même !";
                actions.push('whatsapp_button');
            }
            break;
            
        case 'location':
            response = getRandomResponse(domtechKnowledge.responses.location);
            followUpQuestions = ["Dans quel quartier êtes-vous ?"];
            break;
            
        case 'problem':
            response = generateProblemDiagnosisResponse(primaryService, userMessage);
            actions.push('urgent_call_button', 'whatsapp_button');
            conversationContext.stage = 'problem_diagnosis';
            break;
            
        case 'appointment':
            leadScoringSystem.updateScore('ask_appointment');
            response = generateAppointmentResponse();
            actions.push('whatsapp_button', 'call_button');
            break;
            
        case 'quality':
            response = getRandomResponse(domtechKnowledge.responses.quality_assurance);
            response += "\n\n📋 Témoignages récents :\n";
            response += "⭐ \"Service exceptionnel !\" - Marie K. (Cocody)\n";
            response += "⭐ \"Très professionnel\" - Jean B. (Marcory)\n";
            response += "⭐ \"Intervention rapide\" - Fatou K. (Yopougon)";
            break;
            
        default:
            response = generateContextualResponse(userMessage, analysis);
            break;
    }
    
    // Ajout de questions de suivi intelligentes
    if (followUpQuestions.length === 0) {
        followUpQuestions = generateSmartFollowUp(analysis);
    }
    
    // Personnalisation selon le sentiment
    if (sentiment === 'negative') {
        response = "😔 Je comprends votre frustration.\n\n" + response;
        response += "\n\n💪 DOMTECH va résoudre votre problème rapidement !";
    } else if (sentiment === 'positive') {
        response += "\n\n😊 Ravi de votre confiance en DOMTECH !";
    }
    
    return { response, actions, followUpQuestions };
}

// Fonctions de génération spécialisées
function generateServiceResponse(serviceKey) {
    const service = domtechKnowledge.services[serviceKey];
    let response = `🔧 ${service.name}\n\n`;
    response += `📋 ${service.description}\n\n`;
    response += `💰 Nos tarifs :\n`;
    
    for (let [type, price] of Object.entries(service.prices)) {
        const displayType = type.replace('-', ' + ').replace(/^\w/, c => c.toUpperCase());
        response += `• ${displayType} : ${price.toLocaleString()} FCFA\n`;
    }
    
    response += `\n💡 Conseils DOMTECH :\n`;
    service.tips.forEach(tip => {
        response += `• ${tip}\n`;
    });
    
    response += `\n🔍 Problèmes courants que nous résolvons :\n`;
    service.commonProblems.forEach(problem => {
        response += `• ${problem}\n`;
    });
    
    response += "\n📞 Besoin d'un devis personnalisé ?";
    
    return response;
}

function generatePricingResponse(serviceKey) {
    const service = domtechKnowledge.services[serviceKey];
    let response = `💰 Tarifs ${service.name} :\n\n`;
    
    for (let [type, price] of Object.entries(service.prices)) {
        const displayType = type.replace('-', ' + ').replace(/^\w/, c => c.toUpperCase());
        response += `💳 ${displayType} : ${price.toLocaleString()} FCFA\n`;
    }
    
    response += `\n🎁 INCLUS dans nos prix :\n`;
    response += `• Déplacement gratuit\n• Diagnostic complet\n• Garantie travaux\n• Conseils personnalisés\n`;
    response += `\n📊 Utilisez notre calculateur pour un devis précis selon votre surface !`;
    
    return response;
}

function generateGeneralPricingResponse() {
    let response = "💰 Aperçu de nos tarifs DOMTECH :\n\n";
    
    for (let [key, service] of Object.entries(domtechKnowledge.services)) {
        const minPrice = Math.min(...Object.values(service.prices));
        response += `${service.name} : à partir de ${minPrice.toLocaleString()} FCFA\n`;
    }
    
    response += "\n🎯 Tarifs adaptés selon :\n";
    response += "• Surface à traiter\n• Complexité de l'installation\n• Urgence de l'intervention\n";
    response += "\n📊 Calculateur de devis disponible pour estimation précise !";
    
    return response;
}

function generateProblemDiagnosisResponse(serviceKey, userMessage) {
    let response = "🔍 DIAGNOSTIC DOMTECH en cours...\n\n";
    
    if (serviceKey) {
        const service = domtechKnowledge.services[serviceKey];
        response += `🔧 Problème ${service.name} détecté :\n\n`;
        
        // Analyse des mots-clés pour diagnostic
        const problemKeywords = {
            'ne marche pas': 'Vérifiez l\'alimentation électrique',
            'bruit': 'Problème mécanique possible',
            'fuite': 'Étanchéité à contrôler',
            'chaud': 'Système de refroidissement défaillant',
            'froid': 'Thermostat ou gaz réfrigérant'
        };
        
        let diagnosisFound = false;
        for (let [keyword, diagnosis] of Object.entries(problemKeywords)) {
            if (userMessage.toLowerCase().includes(keyword)) {
                response += `💡 Diagnostic préliminaire : ${diagnosis}\n`;
                diagnosisFound = true;
                break;
            }
        }
        
        if (!diagnosisFound) {
            response += `💡 Diagnostic nécessaire sur site\n`;
        }
        
        response += `\n⚡ Solutions DOMTECH :\n`;
        response += `• Intervention sous 2h\n`;
        response += `• Diagnostic gratuit\n`;
        response += `• Réparation immédiate si possible\n`;
        response += `• Pièces d'origine disponibles\n\n`;
        response += `💰 Dépannage : ${service.prices.depannage?.toLocaleString() || 'Sur devis'} FCFA`;
    } else {
        response += "Pour un diagnostic précis, j'ai besoin de savoir :\n";
        response += "• Quel équipement ? (clim, frigo, etc.)\n";
        response += "• Quels symptômes exactement ?\n";
        response += "• Depuis quand ?\n";
        response += "• Marque et modèle si possible";
    }
    
    response += "\n\n🚨 Intervention urgente disponible 24/7 !";
    return response;
}

function generateAppointmentResponse() {
    let response = "📅 PRISE DE RENDEZ-VOUS DOMTECH\n\n";
    response += "🕐 Créneaux disponibles :\n";
    response += "• Matin : 8h00-12h00\n";
    response += "• Après-midi : 14h00-18h00\n";
    response += "• Samedi matin : 9h00-13h00\n\n";
    
    response += "📋 Informations nécessaires :\n";
    response += "• Type d'intervention\n";
    response += "• Adresse complète\n";
    response += "• Numéro de téléphone\n";
    response += "• Créneau préféré\n\n";
    
    response += "⚡ Réservation immédiate :\n";
    response += "• WhatsApp : confirmation instantanée\n";
    response += "• Téléphone : planning en temps réel\n\n";
    
    response += "🎁 BONUS : Devis gratuit à domicile !";
    
    return response;
}

function generateContextualResponse(userMessage, analysis) {
    const { services, intents } = analysis;
    
    // Réponse basée sur le contexte de conversation
    if (conversationContext.stage === 'problem_diagnosis') {
        return "🔍 Merci pour ces détails supplémentaires !\n\nPour un diagnostic complet et une solution rapide, nos techniciens DOMTECH peuvent intervenir aujourd'hui même.\n\n📞 Contactez-nous maintenant pour programmer l'intervention !";
    }
    
    if (conversationContext.serviceInterest) {
        const service = domtechKnowledge.services[conversationContext.serviceInterest];
        return `Concernant votre projet ${service.name.toLowerCase()}, je peux vous aider avec :\n\n• 💰 Devis détaillé gratuit\n• 📅 Planification intervention\n• 🔧 Conseils techniques\n• 🚨 Dépannage urgent\n\nQue souhaitez-vous savoir exactement ?`;
    }
    
    // Réponse par défaut intelligente
    let response = "🤔 Je veux m'assurer de bien vous aider !\n\n";
    response += "🎯 DOMTECH peut vous accompagner sur :\n";
    response += "• 💰 Devis et tarifs\n• 🔧 Conseils techniques\n• 📅 Prise de rendez-vous\n• 🚨 Interventions urgentes\n• 📍 Zones d'intervention\n\n";
    response += "💬 Reformulez votre question ou choisissez un sujet !";
    
    return response;
}

function generateSmartFollowUp(analysis) {
    const { services, intents } = analysis;
    const leadLevel = leadScoringSystem.getLeadLevel();
    
    let questions = [];
    
    if (leadLevel === 'hot') {
        questions = [
            "Souhaitez-vous programmer une intervention ?",
            "Quel est votre budget pour ce projet ?",
            "Quand souhaitez-vous que nous intervenions ?"
        ];
    } else if (leadLevel === 'warm') {
        questions = [
            "Avez-vous d'autres questions sur nos services ?",
            "Souhaitez-vous un devis personnalisé ?",
            "Dans quel quartier d'Abidjan êtes-vous ?"
        ];
    } else {
        questions = [
            "Quel service DOMTECH vous intéresse le plus ?",
            "Avez-vous un projet en cours ?",
            "Souhaitez-vous découvrir nos réalisations ?"
        ];
    }
    
    return questions;
}

// Utilitaires
function getRandomResponse(responses) {
    return responses[Math.floor(Math.random() * responses.length)];
}

function isOutsideBusinessHours() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Dimanche ou en dehors des heures d'ouverture
    return day === 0 || hour < 8 || hour >= 18 || (day === 6 && hour >= 13);
}

// Interface utilisateur améliorée avec MÉMOIRE
function toggleChatbot() {
    const chatbot = document.getElementById('chatbot');
    chatbotOpen = !chatbotOpen;
    chatbot.classList.toggle('active', chatbotOpen);
    
    if (chatbotOpen && conversationContext.conversationHistory.length === 0) {
        // Initialisation de la session avec mémoire
        initializeClientSession();
    }
}

// Initialise une nouvelle session client avec mémoire
function initializeClientSession() {
    // Génération/récupération de l'ID client
    currentClientId = memorySystem.generateClientId();
    
    // Nettoyage des anciennes mémoires
    memorySystem.cleanOldMemories();
    
    // Récupération de la mémoire client
    const clientMemory = memorySystem.getClientMemory(currentClientId);
    
    // Restauration du contexte si client existant
    if (clientMemory) {
        conversationContext.returningClient = true;
        const lastContext = memorySystem.getLastConversationContext(clientMemory);
        
        if (lastContext) {
            conversationContext.serviceInterest = lastContext.serviceInterest;
            conversationContext.leadScore = lastContext.leadScore;
            conversationContext.userInfo = lastContext.clientInfo || {};
            
            console.log(`🧠 Contexte restauré pour client ${currentClientId}:`, lastContext);
        }
    }
    
    setTimeout(() => {
        let welcomeMsg;
        
        if (clientMemory) {
            // Message personnalisé pour client existant
            welcomeMsg = memorySystem.generateWelcomeMessage(clientMemory);
            
            // Ajout d'informations contextuelles
            if (clientMemory.conversations.length > 0) {
                const lastConv = clientMemory.conversations[0];
                
                // Rappel du dernier sujet si récent (moins de 7 jours)
                const daysSince = Math.floor((Date.now() - lastConv.timestamp) / (24 * 60 * 60 * 1000));
                if (daysSince < 7 && lastConv.keyTopics.length > 0) {
                    welcomeMsg += `\n\n🔍 Sujets récents : ${lastConv.keyTopics.slice(0, 3).join(', ')}`;
                }
                
                // Proposition de continuité
                if (lastConv.serviceInterest && lastConv.leadScore > 10) {
                    const serviceName = domtechKnowledge.services[lastConv.serviceInterest]?.name;
                    welcomeMsg += `\n\n💡 Souhaitez-vous continuer sur ${serviceName} ?`;
                }
            }
        } else {
            // Message standard pour nouveau client
            welcomeMsg = "👋 Bienvenue chez DOMTECH !\n\n🤖 Je suis votre assistant IA personnel.\n\n🔧 Je peux vous aider avec :\n• Devis instantanés et personnalisés\n• Diagnostic de pannes\n• Conseils techniques d'expert\n• Prise de rendez-vous\n• Urgences 24/7\n\n💬 Décrivez-moi votre projet ou votre problème !";
        }
        
        addChatMessage(welcomeMsg, 'bot');
        
        // Affichage des statistiques de mémoire en console
        if (clientMemory) {
            console.log(`📊 Statistiques client ${currentClientId}:`, {
                totalConversations: clientMemory.totalConversations,
                totalLeadScore: clientMemory.totalLeadScore,
                preferredServices: clientMemory.preferredServices,
                firstVisit: new Date(clientMemory.firstVisit).toLocaleDateString()
            });
        }
    }, 800);
}

function handleChatInput(event) {
    if (event.key === 'Enter') {
        const input = document.getElementById('chatbot-input');
        const message = input.value.trim();
        
        if (message) {
            addChatMessage(message, 'user');
            conversationContext.conversationHistory.push({
                type: 'user', 
                message, 
                timestamp: Date.now()
            });
            
            // Indicateur de traitement IA
            addAIProcessingIndicator();
            
            setTimeout(() => {
                removeAIProcessingIndicator();
                const analysis = analyzeMessage(message);
                const { response, actions, followUpQuestions } = generateIntelligentResponse(message, analysis);
                
                addChatMessage(response, 'bot', actions);
                
                // Ajout des questions de suivi
                if (followUpQuestions && followUpQuestions.length > 0) {
                    setTimeout(() => {
                        const followUpMsg = "🤔 Questions pour mieux vous aider :\n" + followUpQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
                        addChatMessage(followUpMsg, 'bot');
                    }, 2000);
                }
                
                conversationContext.conversationHistory.push({
                    type: 'bot', 
                    message: response, 
                    timestamp: Date.now(),
                    analysis: analysis
                });
                
                // Sauvegarde automatique après chaque échange
                autoSaveConversation();
                
            }, 2000);
            
            input.value = '';
        }
    }
}

// Sauvegarde automatique de la conversation
function autoSaveConversation() {
    if (currentClientId && conversationContext.conversationHistory.length > 0) {
        // Sauvegarde uniquement si la conversation a du contenu significatif
        const userMessages = conversationContext.conversationHistory.filter(msg => msg.type === 'user');
        if (userMessages.length >= 1) {
            memorySystem.saveConversation(currentClientId, conversationContext);
        }
    }
}

// Sauvegarde finale lors de la fermeture
function finalizeConversation() {
    if (currentClientId && conversationContext.conversationHistory.length > 0) {
        const success = memorySystem.saveConversation(currentClientId, conversationContext);
        if (success) {
            console.log(`💾 Conversation finalisée et sauvegardée pour ${currentClientId}`);
        }
    }
}

function addChatMessage(message, sender, actions = []) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    
    const isUser = sender === 'user';
    messageDiv.className = `mb-4 ${isUser ? 'ml-8' : 'mr-8'}`;
    
    const bubble = document.createElement('div');
    bubble.className = `p-4 rounded-2xl ${isUser ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-white border border-gray-200 rounded-bl-sm shadow-sm'}`;
    
    // Formatage du message avec emojis et mise en forme
    const formattedMessage = message.replace(/\n/g, '<br>');
    bubble.innerHTML = formattedMessage;
    
    messageDiv.appendChild(bubble);
    
    // Ajout des boutons d'action
    if (actions.length > 0 && !isUser) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'mt-3 flex flex-wrap gap-2';
        
        actions.forEach(action => {
            const button = createActionButton(action);
            if (button) actionsDiv.appendChild(button);
        });
        
        messageDiv.appendChild(actionsDiv);
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createActionButton(action) {
    const button = document.createElement('button');
    button.className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105';
    
    switch (action) {
        case 'whatsapp_button':
            button.textContent = '💬 WhatsApp';
            button.className += ' bg-green-500 text-white hover:bg-green-600';
            button.onclick = () => window.open('https://wa.me/2250710367602?text=Bonjour%20DOMTECH,%20je%20viens%20du%20chat%20IA%20de%20votre%20site', '_blank');
            break;
        case 'urgent_whatsapp_button':
            button.textContent = '🚨 WhatsApp URGENT';
            button.className += ' bg-red-500 text-white hover:bg-red-600 animate-pulse';
            button.onclick = () => window.open('https://wa.me/2250710367602?text=🚨%20URGENCE%20-%20Besoin%20intervention%20immédiate', '_blank');
            break;
        case 'call_button':
            button.textContent = '📞 Appeler';
            button.className += ' bg-blue-500 text-white hover:bg-blue-600';
            button.onclick = () => window.open('tel:+2250710367602');
            break;
        case 'urgent_call_button':
            button.textContent = '🚨 APPEL URGENT';
            button.className += ' bg-red-600 text-white hover:bg-red-700 animate-bounce';
            button.onclick = () => window.open('tel:+2250710367602');
            break;
        case 'calculator_button':
            button.textContent = '📊 Calculateur';
            button.className += ' bg-purple-500 text-white hover:bg-purple-600';
            button.onclick = () => {
                toggleChatbot();
                document.querySelector('#service-type').scrollIntoView({behavior: 'smooth'});
            };
            break;
        case 'quote_button':
            button.textContent = '📋 Devis Gratuit';
            button.className += ' bg-orange-500 text-white hover:bg-orange-600';
            button.onclick = () => {
                toggleChatbot();
                document.querySelector('#contact').scrollIntoView({behavior: 'smooth'});
            };
            break;
        default:
            return null;
    }
    
    return button;
}

function addAIProcessingIndicator() {
    const messagesContainer = document.getElementById('chatbot-messages');
    const processingDiv = document.createElement('div');
    processingDiv.id = 'ai-processing';
    processingDiv.className = 'mb-4 mr-8';
    
    const bubble = document.createElement('div');
    bubble.className = 'p-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-bl-sm';
    bubble.innerHTML = `
        <div class="flex items-center space-x-2">
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span>🤖 IA DOMTECH analyse votre demande...</span>
        </div>
    `;
    
    processingDiv.appendChild(bubble);
    messagesContainer.appendChild(processingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeAIProcessingIndicator() {
    const processingIndicator = document.getElementById('ai-processing');
    if (processingIndicator) {
        processingIndicator.remove();
    }
}

// Fonction pour envoyer un message via le bouton
function sendMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();
    
    if (message) {
        // Simuler l'appui sur Entrée
        const event = new KeyboardEvent('keypress', {
            key: 'Enter',
            code: 'Enter',
            which: 13,
            keyCode: 13,
        });
        handleChatInput(event);
    }
}

// Initialisation du chatbot IA avec MÉMOIRE PERSISTANTE
document.addEventListener('DOMContentLoaded', function() {
    console.log('🤖 Chatbot IA DOMTECH initialisé avec succès !');
    console.log('📊 Système de scoring des prospects activé');
    console.log('🧠 Traitement du langage naturel opérationnel');
    console.log('💾 Système de mémoire persistante activé');
    console.log('💡 Fonctionnalités IA disponibles :');
    console.log('   • Analyse sémantique des messages');
    console.log('   • Détection d\'intentions multiples');
    console.log('   • Scoring automatique des prospects');
    console.log('   • Diagnostic technique intelligent');
    console.log('   • Réponses contextuelles adaptatives');
    console.log('   • Gestion des urgences automatique');
    console.log('   • MÉMOIRE des conversations clients');
    console.log('   • Personnalisation selon l\'historique');
    
    // Nettoyage initial des anciennes mémoires
    memorySystem.cleanOldMemories();
    
    // Affichage des statistiques de mémoire
    const allMemories = memorySystem.getAllMemories();
    const clientCount = Object.keys(allMemories).length;
    const totalConversations = Object.values(allMemories).reduce((sum, client) => sum + client.totalConversations, 0);
    
    console.log(`📈 Statistiques mémoire : ${clientCount} clients, ${totalConversations} conversations stockées`);
});

// Sauvegarde automatique lors de la fermeture du navigateur
window.addEventListener('beforeunload', function(e) {
    finalizeConversation();
});

// Sauvegarde automatique lors de la fermeture de l'onglet
window.addEventListener('unload', function(e) {
    finalizeConversation();
});

// Sauvegarde automatique lors de la perte de focus (changement d'onglet)
window.addEventListener('blur', function(e) {
    autoSaveConversation();
});

// Sauvegarde périodique (toutes les 2 minutes)
setInterval(() => {
    autoSaveConversation();
}, 120000);

// Fonction pour afficher les statistiques de mémoire (debug)
function showMemoryStats() {
    const memories = memorySystem.getAllMemories();
    console.log('📊 STATISTIQUES MÉMOIRE DOMTECH:', memories);
    
    for (let clientId in memories) {
        const client = memories[clientId];
        console.log(`👤 Client ${clientId}:`, {
            conversations: client.totalConversations,
            leadScore: client.totalLeadScore,
            services: client.preferredServices,
            dernièreVisite: new Date(client.conversations[0]?.timestamp).toLocaleString()
        });
    }
}

// Fonction pour nettoyer toutes les mémoires (debug)
function clearAllMemories() {
    localStorage.removeItem('domtech_client_memories');
    localStorage.removeItem('domtech_client_id');
    console.log('🧹 Toutes les mémoires ont été effacées');
}
