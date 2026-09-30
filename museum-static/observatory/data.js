(function(){
  var pending="Definition pending / source recovery needed.";
  function t(term,opts){
    opts=opts||{};
    return {
      id:(opts.id||term.toLowerCase().replace(/[’']/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")),
      term:term,
      stage:opts.stage||"forge",
      coined:opts.coined||"2026",
      precision:opts.precision||"year",
      formation:opts.formation||"unclassified",
      definition:opts.definition||pending,
      fullDefinition:opts.fullDefinition||opts.definition||pending,
      roots:opts.roots||[],
      domains:opts.domains||[],
      tags:opts.tags||[],
      conceptualRole:opts.conceptualRole||"",
      birthCondition:opts.birthCondition||"",
      wordIdeaOrder:opts.wordIdeaOrder||"uncertain",
      provenance:opts.provenance||"Documented in personal archive; external priority not yet audited.",
      provenanceStatus:opts.provenanceStatus||"uncertain",
      transmission:opts.transmission||"self",
      visibility:"public",
      versions:opts.versions||[],
      events:opts.events||[],
      witnesses:opts.witnesses||[],
      attestations:opts.attestations||[],
      continuity:{
        objective:(opts.continuity&&opts.continuity.objective)||"Recover originating context and determine whether the term names a durable conceptual distinction.",
        observedProblem:(opts.continuity&&opts.continuity.observedProblem)||"",
        epistemicType:(opts.continuity&&opts.continuity.epistemicType)||null,
        confidence:(opts.continuity&&typeof opts.continuity.confidence==="number")?opts.continuity.confidence:null,
        state:(opts.continuity&&opts.continuity.state)||"CONTINUE",
        openQuestions:(opts.continuity&&opts.continuity.openQuestions)||["What exact distinction was this term originally trying to preserve?"],
        nextStep:(opts.continuity&&opts.continuity.nextStep)||"Locate the earliest source witness and stabilize or retire the definition."
      }
    };
  }
  var terms=[
    t("Suffralchemy",{
      stage:"lexicon",coined:"2026-09-29",precision:"day",formation:"phonosemantic blend",
      definition:"The deliberate transformation of suffering into something valuable without implying the suffering itself was good or a blessing.",
      roots:["suffering","alchemy"],domains:["meaning-making","adversity","transformation"],tags:["process","ethics"],
      conceptualRole:"Separates the value created from suffering from any claim that the suffering itself was valuable.",
      birthCondition:"Coined while distinguishing growth extracted from mistreatment from treating mistreatment as a blessing.",
      wordIdeaOrder:"simultaneous",provenanceStatus:"claimed_coinage",
      continuity:{objective:"Preserve a precise distinction between suffering and what a person deliberately makes from it.",epistemicType:"DECISION",confidence:.95,state:"REFERENCE",openQuestions:["Which transformations qualify as deliberate enough to count?","Does the concept include communal as well as individual transformation?"],nextStep:"Develop examples, counterexamples, and derivative forms without weakening the ethical distinction."},
      versions:[{v:1,date:"2026-09-29",definition:"The deliberate transformation of suffering into something valuable without implying the suffering itself was good or a blessing.",note:"Working definition preserved as the initial Observatory definition."}]
    }),
    t("Psycheligious",{
      coined:"2026-09-30",precision:"day",formation:"phonological blend",
      definition:"Provisional: a term for territory where psychological experience and religious or spiritual interpretation overlap.",
      roots:["psyche","religious"],domains:["psychology","spirituality","interpretation"],tags:["interface"],
      conceptualRole:"Creates descriptive room between reducing an experience to psychology and prematurely declaring it supernatural.",
      birthCondition:"Emerged through sound-first lexical play around psychology and religious interpretation.",
      wordIdeaOrder:"word_first",
      continuity:{objective:"Develop vocabulary for experiences that can carry both psychological and spiritual interpretations without forcing an early metaphysical verdict.",epistemicType:"HYPOTHESIS",confidence:.72,state:"PROCESSING",openQuestions:["How should this differ from psychreligious?","Is the term descriptive, methodological, or both?"],nextStep:"Define boundary cases and decide whether Psycheligious or Psychreligious should be the primary form."}
    }),
    t("Psychreligious",{
      coined:"2026-09-30",precision:"day",formation:"blend",
      definition:"Provisional variant related to Psycheligious; exact distinction remains unresolved.",
      roots:["psych-","religious"],domains:["psychology","spirituality"],tags:["variant"],
      wordIdeaOrder:"word_first",
      continuity:{objective:"Determine whether this form deserves a distinct meaning or should remain a historical variant.",epistemicType:"QUESTION",confidence:.45,state:"CONTINUE",openQuestions:["Does this form imply a different emphasis from Psycheligious?"],nextStep:"Compare actual usage contexts before assigning a separate definition."}
    }),
    t("Illogicational",{
      coined:"2026-09-30",precision:"day",formation:"derivation",
      definition:"Provisional: relating to a process, system, or rhetoric that produces, operationalizes, or perpetuates illogic.",
      roots:["illogic","-ational"],domains:["reasoning","systems","rhetoric"],tags:["process"],
      conceptualRole:"Potentially shifts illogic from a static property to a produced mechanism.",
      wordIdeaOrder:"word_first",
      continuity:{objective:"Test whether the word captures a useful distinction between being illogical and manufacturing illogic.",epistemicType:"HYPOTHESIS",confidence:.64,state:"PROCESSING",openQuestions:["What makes a process illogicational rather than merely mistaken?"],nextStep:"Develop contrasting examples."}
    }),
    t("Apropoetry",{
      coined:"2026-09-29",precision:"day",formation:"portmanteau",
      definition:"Provisional wordplay blend around apropos and poetry.",
      roots:["apropos","poetry"],domains:["poetics","wordplay"],tags:["blend"],
      wordIdeaOrder:"word_first",
      continuity:{objective:"Recover the originating context and determine whether the term names a genre, technique, or joke.",epistemicType:"QUESTION",confidence:.35,state:"CONTINUE",openQuestions:["What was the intended functional definition?"],nextStep:"Locate first-use context."}
    }),
    t("Metacognoia",{formation:"classical-root blend",roots:["meta-","cognoia"],domains:["metacognition","epistemology"],definition:"Provisional: a coined construction concerning knowing or awareness about cognition itself.",wordIdeaOrder:"word_first"}),
    t("Cognoia",{formation:"root neologism",roots:["cogn-"],domains:["cognition","epistemology"]}),
    t("Muertacognoia",{formation:"cross-lingual blend",roots:["muerta/muerte?","cognoia"],domains:["mortality","cognition"]}),
    t("Audiodacity",{formation:"portmanteau",domains:["sound","wordplay"]}),
    t("Aldabulacular",{formation:"phonological construction",domains:["wordplay"]}),
    t("Ellacutia",{formation:"neologism",domains:["language"]}),
    t("Emotional Radiation",{formation:"compound",domains:["emotion","social dynamics"]}),
    t("Complicatizing",{formation:"derivation",domains:["systems","behavior"]}),
    t("collapstrophe",{formation:"portmanteau",domains:["collapse","systems"]}),
    t("collapstrophy",{formation:"variant",domains:["collapse","systems"]}),
    t("Casually Causal",{formation:"phonosemantic phrase",domains:["causality","wordplay"]}),
    t("Hydra-Index",{formation:"compound",domains:["classification","systems"]}),
    t("Hyperboliever",{formation:"portmanteau",domains:["belief","rhetoric"]}),
    t("Libracdified",{formation:"blend",domains:["identity","astrology"]}),
    t("Libractifide",{formation:"variant",domains:["identity","astrology"]}),
    t("Magnificentification",{formation:"derivation",domains:["transformation","wordplay"]}),
    t("Occipitalization",{formation:"derivation",domains:["perception","cognition"]}),
    t("preconceived precotions",{formation:"phonological phrase",domains:["cognition","wordplay"]}),
    t("Radicosity",{formation:"derivation",domains:["roots","inquiry"]}),
    t("re-absecentigrate",{formation:"complex blend",domains:["transformation","wordplay"]}),
    t("Redevra-dingiate",{formation:"complex blend",domains:["transformation","wordplay"]}),
    t("Us-conscious",{formation:"compound",domains:["collective cognition","social psychology"]}),
    t("Burrit’o’clock",{formation:"portmanteau",domains:["humor","time"]}),
    t("goblinry",{formation:"derivation",domains:["humor","behavior"]}),
    t("fran",{formation:"root neologism",domains:["social relationships"]}),
    t("franbase",{formation:"derivative",roots:["fran","base"],domains:["social relationships"]}),
    t("franship",{formation:"derivative",roots:["fran","-ship"],domains:["social relationships"]}),
    t("glossolalien",{formation:"derivation",domains:["language","spirituality"]}),
    t("GOAT-ing",{formation:"conversion",domains:["status","culture"]}),
    t("phonosemantic recursion",{formation:"technical compound",domains:["language","poetics","cognition"],definition:"Working term for recursive interaction between sound-pattern and meaning-pattern.",roots:["phono-","semantic","recursion"],wordIdeaOrder:"simultaneous",
      continuity:{objective:"Describe cases where sound-pattern and semantic structure repeatedly generate or reinforce one another.",epistemicType:"HYPOTHESIS",confidence:.7,state:"PROCESSING",openQuestions:["What would distinguish recursion from ordinary sound symbolism or rhyme?"],nextStep:"Create formal examples and non-examples."}
    })
  ];
  var relations=[
    ["psycheligious","psychreligious","semantic_relative"],
    ["metacognoia","cognoia","derivative_of"],
    ["muertacognoia","cognoia","derivative_of"],
    ["collapstrophy","collapstrophe","semantic_relative"],
    ["libractifide","libracdified","semantic_relative"],
    ["franbase","fran","derivative_of"],
    ["franship","fran","derivative_of"],
    ["phonosemantic-recursion","audiodacity","same_domain"]
  ];
  window.LEXICAL_SEED={terms:terms,relations:relations,importedAt:"2026-09-30",schemaVersion:1};
})();