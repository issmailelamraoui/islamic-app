import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { CapacitorHttp } from '@capacitor/core';
import {
  BookOpen, Search, Bookmark, Play, Pause,
  Moon, Sun, ChevronRight, ChevronLeft, Info,
  X, List, Sparkles, Loader2, Volume2,
  ZoomIn, ZoomOut, MessageCircle, Send, Copy, Check
} from 'lucide-react';

// --- CONFIG & CONSTANTS ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyDPluj2d4RPxxUYbkt6Dm2xWKlLi86xHyk"; // Gemini API Key will be injected by the environment
const GEMINI_URL = API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`
  : null;

const SURAH_START_PAGES = [
  1, 2, 50, 77, 106, 128, 151, 177, 187, 208, 221, 235, 249, 255, 262, 267, 282, 293, 305, 312,
  322, 332, 342, 350, 359, 367, 377, 385, 396, 404, 411, 415, 418, 428, 434, 440, 446, 453, 458,
  467, 477, 483, 489, 496, 499, 502, 507, 511, 515, 518, 520, 523, 526, 528, 531, 534, 537, 542,
  545, 549, 551, 553, 554, 556, 558, 560, 562, 564, 566, 568, 570, 572, 574, 575, 577, 578, 580,
  582, 583, 585, 586, 587, 587, 589, 590, 591, 591, 592, 593, 594, 595, 595, 596, 596, 597, 597,
  598, 598, 599, 599, 600, 600, 601, 601, 601, 602, 602, 602, 603, 603, 603, 604, 604, 604
];

const injectFonts = () => {
  if (!document.getElementById('quran-fonts')) {
    const style = document.createElement('style');
    style.id = 'quran-fonts';
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Cairo:wght@400;600;700&display=swap');
      .font-quran { font-family: 'Amiri Quran', serif; }
      .font-ui { font-family: 'Cairo', sans-serif; }

      .mushaf-bg-dark {
        background-color: #09090b;
        background-image: url("data:image/svg+xml,%3Csvg width='80' height='80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg stroke='%23d4af37' stroke-width='1.5' fill='none' opacity='0.04'%3E%3Crect x='25' y='25' width='30' height='30' /%3E%3Crect x='25' y='25' width='30' height='30' transform='rotate(45 40 40)' /%3E%3C/g%3E%3Cg stroke='%23d4af37' stroke-width='1.5' fill='none' opacity='0.04'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45 0 0)' /%3E%3Crect x='65' y='-15' width='30' height='30' /%3E%3Crect x='65' y='-15' width='30' height='30' transform='rotate(45 80 0)' /%3E%3Crect x='-15' y='65' width='30' height='30' /%3E%3Crect x='-15' y='65' width='30' height='30' transform='rotate(45 0 80)' /%3E%3Crect x='65' y='65' width='30' height='30' /%3E%3Crect x='65' y='65' width='30' height='30' transform='rotate(45 80 80)' /%3E%3C/g%3E%3C/svg%3E");
      }
      .mushaf-bg-light {
        background-color: #fdfbf7;
        background-image: url("data:image/svg+xml,%3Csvg width='80' height='80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg stroke='%23d4af37' stroke-width='1.5' fill='none' opacity='0.08'%3E%3Crect x='25' y='25' width='30' height='30' /%3E%3Crect x='25' y='25' width='30' height='30' transform='rotate(45 40 40)' /%3E%3C/g%3E%3Cg stroke='%23d4af37' stroke-width='1.5' fill='none' opacity='0.08'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45 0 0)' /%3E%3Crect x='65' y='-15' width='30' height='30' /%3E%3Crect x='65' y='-15' width='30' height='30' transform='rotate(45 80 0)' /%3E%3Crect x='-15' y='65' width='30' height='30' /%3E%3Crect x='-15' y='65' width='30' height='30' transform='rotate(45 0 80)' /%3E%3Crect x='65' y='65' width='30' height='30' /%3E%3Crect x='65' y='65' width='30' height='30' transform='rotate(45 80 80)' /%3E%3C/g%3E%3C/svg%3E");
      }

      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #d4af37; border-radius: 4px; }
    `;
    document.head.appendChild(style);
  }
};

const toArabicNum = (n) => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
};

// --- RAM Caching ---
const pageCache = new Map();
const surahsCache = { data: null };

const fetchQuranPage = async (page) => {
  if (pageCache.has(page)) return pageCache.get(page);
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/page/${page}/quran-uthmani`);
    const data = await res.json();
    pageCache.set(page, data.data);
    return data.data;
  } catch (error) {
    console.error("Error fetching page:", error);
    return null;
  }
};

const fetchSurahs = async () => {
  if (surahsCache.data) return surahsCache.data;
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/surah`);
    const data = await res.json();
    surahsCache.data = data.data;
    return data.data;
  } catch (error) {
    console.error("Error fetching surahs:", error);
    return [];
  }
};

const fetchTafsirWithRetry = async (ayahText, retries = 5) => {
  if (!GEMINI_URL) {
    return "مِفْتَاحُ واجِهَةِ Gemini غَيْرُ مُعَدٍّ. يُرْجَى إِضافَةُ VITE_GEMINI_API_KEY.";
  }
  // Zedt hna "ومشكولاً تشكيلاً تاماً (بالحركات)" bach yjawbna AI b chkel
  const prompt = `أعطني تفسيراً مختصراً جداً وواضحاً ومشكولاً تشكيلاً تاماً (بالحركات) باللغة العربية لهذه الآية الكريمة، بدون مقدمات أو تفاصيل معقدة (في حدود 3-4 أسطر كحد أقصى):\n"${ayahText}"`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: "You are a helpful Islamic scholar providing short, highly accurate, and accessible Tafsir of the Quran in Arabic. You MUST fully vocalize (add Tashkeel / Harakat to) all your Arabic responses." }] }
  };

  for (let i = 0; i < retries; i++) {
    try {
      const response = await CapacitorHttp.post({
        url: GEMINI_URL,
        headers: { 'Content-Type': 'application/json' },
        data: payload
      });

      // FIXED: Check status code instead of .ok
      if (response.status !== 200) throw new Error('API Error');

      // FIXED: Use response.data directly (it is already parsed)
      const data = response.data;

      return data.candidates?.[0]?.content?.parts?.[0]?.text || "عُذْراً، لَمْ أَتَمَكَّنْ مِنْ جَلْبِ التَّفْسِيرِ.";
    } catch (err) {
      console.error('Gemini tafsir error:', err);
      if (i === retries - 1) return "حَدَثَ خَطَأٌ فِي الاِتِّصَالِ. يُرْجَى الْمُحَاوَلَةُ مَرَّةً أُخْرَى لاَحِقاً.";
      await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
    }
  }
};

const fetchAIChatResponse = async (question) => {
  if (!GEMINI_URL) {
    return "مِفْتَاحُ واجِهَةِ Gemini غَيْرُ مُعَدٍّ. يُرْجَى إِضافَةُ VITE_GEMINI_API_KEY.";
  }
  const payload = {
    contents: [{ parts: [{ text: question }] }],
    systemInstruction: { parts: [{ text: "أنت مساعد إسلامي ذكي وموثوق. تجيب على أسئلة المستخدمين بناءً على القرآن الكريم والسنة النبوية الصحيحة. إجاباتك يجب أن تكون دقيقة، مختصرة قدر الإمكان، ومكتوبة بلغة عربية سليمة ومشكولة تشكيلاً تاماً (بالحركات)." }] }
  };

  try {
    const response = await CapacitorHttp.post({
      url: GEMINI_URL,
      headers: { 'Content-Type': 'application/json' },
      data: payload
    });

    // FIXED: Check status code
    if (response.status !== 200) throw new Error('API Error');

    // FIXED: Use response.data directly
    const data = response.data;

    return data.candidates?.[0]?.content?.parts?.[0]?.text || "عُذْراً، لَمْ أَتَمَكَّنْ مِنَ الإِجَابَةِ.";
  } catch (err) {
    console.error('Gemini chat error:', err);
    return "حَدَثَ خَطَأٌ فِي الاِتِّصَالِ. يُرْجَى الْمُحَاوَلَةُ مَرَّةً أُخْرَى لاَحِقاً.";
  }
};

const AyahItem = memo(({ ayah, isSelected, isPlayingThisAyah, isBookmarked, onAyahClick, isDarkMode }) => {
  let highlightClass = '';
  if (isSelected) {
    // Loun dyal l-aya mnin kat-sélectionniha (bla background)
    highlightClass = isDarkMode ? 'text-amber-400' : 'text-amber-600';
  } else if (isPlayingThisAyah) {
    // Loun dyal l-aya mnin katkun khdama f l-audio
    highlightClass = isDarkMode ? 'text-amber-300' : 'text-amber-700';
  } else if (isBookmarked) {
    // Loun dyal l-aya mnin katdir liha Bookmark (loun akhder)
    highlightClass = isDarkMode ? 'text-emerald-400' : 'text-emerald-600';
  }

  return (
    <span
      id={`ayah-${ayah.number}`}
      onClick={() => onAyahClick(ayah)}
      className={`cursor-pointer transition-colors duration-300 ${highlightClass}`}
    >
      {ayah.display_text || ayah.text}
      <span className="relative inline-flex items-center justify-center mx-1.5 align-middle" style={{ width: '1.9em', height: '1.9em' }}>
        <svg className={`absolute inset-0 w-full h-full ${isDarkMode ? 'text-amber-500/70' : 'text-amber-600/70'}`}>
          <use href="#ayah-symbol" />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center font-ui font-bold ${isDarkMode ? 'text-amber-300' : 'text-amber-900'}`} style={{ fontSize: '0.65em' }}>
          {toArabicNum(ayah.numberInSurah)}
        </span>
      </span>
    </span>
  );
});

export default function App() {
  const [currentPage, setCurrentPage] = useState(() => {
    const savedPage = localStorage.getItem('mushaf_last_page');
    const parsed = savedPage ? Number.parseInt(savedPage, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : 1;
  });
  const [pageData, setPageData] = useState(null);
  const [surahs, setSurahs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSurahsLoading, setIsSurahsLoading] = useState(false);
  const [surahSearchQuery, setSurahSearchQuery] = useState('');

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('mushaf_theme');
    return savedTheme === 'light' ? false : true;
  });
  const [activeView, setActiveView] = useState('reader');
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const savedBookmarks = localStorage.getItem('mushaf_bookmarks');
      return savedBookmarks ? JSON.parse(savedBookmarks) : [];
    } catch {
      return [];
    }
  });

  // -- FONT SIZE STATE --
  const [fontSize, setFontSize] = useState(() => {
    const savedFontSize = localStorage.getItem('mushaf_font_size');
    const parsed = savedFontSize ? Number.parseInt(savedFontSize, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : 36;
  }); // Main Quran Font Size
  const [tafsirFontSize, setTafsirFontSize] = useState(() => {
    const savedTafsirFontSize = localStorage.getItem('mushaf_tafsir_font_size');
    const parsed = savedTafsirFontSize ? Number.parseInt(savedTafsirFontSize, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : 18;
  }); // Tafsir & Popup Font Size

  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: 'السَّلَامُ عَلَيْكُمْ. أَنَا مُسَاعِدُكَ الذَّكِيُّ. كَيْفَ يُمْكِنُنِي مُسَاعَدَتُكَ الْيَوْمَ فِي أُمُورِ دِينِكَ وَفْقاً لِلْقُرْآنِ وَالسُّنَّةِ؟' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const [selectedAyah, setSelectedAyah] = useState(null);
  const [tafsir, setTafsir] = useState(null);
  const [isTafsirLoading, setIsTafsirLoading] = useState(false);
  const [audioState, setAudioState] = useState({ playing: false, src: null, currentAyahNumber: null });
  const audioRef = useRef(null);
  const playbackState = useRef({ isPlayingPage: false, ayahs: [], currentIndex: 0 });
  const [isPlayingPage, setIsPlayingPage] = useState(false);

  // --- Initialize fonts ---
  useEffect(() => {
    injectFonts();
  }, []);

  // --- Auto-Save font sizes when they change ---
  useEffect(() => {
    localStorage.setItem('mushaf_font_size', fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('mushaf_tafsir_font_size', tafsirFontSize.toString());
  }, [tafsirFontSize]);

  useEffect(() => {
    if (activeView === 'surahs' && surahs.length === 0) {
      const loadSurahsLazy = async () => {
        setIsSurahsLoading(true);
        const data = await fetchSurahs();
        setSurahs(data);
        setIsSurahsLoading(false);
      };
      loadSurahsLazy();
    }
  }, [activeView, surahs.length]);

  useEffect(() => {
    const loadPage = async () => {
      setIsLoading(true);
      const data = await fetchQuranPage(currentPage);
      if (data) setPageData(data);
      setIsLoading(false);
      localStorage.setItem('mushaf_last_page', currentPage.toString());

      setTimeout(() => {
        const scrollTo = sessionStorage.getItem('scroll_to_ayah');
        if (scrollTo) {
          const el = document.getElementById(`ayah-${scrollTo}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          sessionStorage.removeItem('scroll_to_ayah');
        }
      }, 100);
    };

    loadPage();

    if (!sessionStorage.getItem('scroll_to_ayah')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  useEffect(() => {
    if (activeView === 'qa' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeView]);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('mushaf_theme', newTheme ? 'dark' : 'light');
  };

  const toggleBookmark = (ayah) => {
    const isBookmarked = bookmarks.some(b => b.number === ayah.number);
    let newBookmarks;
    if (isBookmarked) {
      newBookmarks = bookmarks.filter(b => b.number !== ayah.number);
    } else {
      newBookmarks = [...bookmarks, {
        number: ayah.number,
        surahName: ayah.surah.name,
        ayahInSurah: ayah.numberInSurah,
        page: currentPage,
        text: ayah.text
      }];
    }
    setBookmarks(newBookmarks);
    localStorage.setItem('mushaf_bookmarks', JSON.stringify(newBookmarks));
  };

  const playCurrentInSequence = useCallback(() => {
    const { ayahs, currentIndex } = playbackState.current;
    if (currentIndex < ayahs.length) {
      const ayah = ayahs[currentIndex];
      const url = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayah.number}.mp3`;
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setAudioState({ playing: true, src: url, currentAyahNumber: ayah.number });
      }
    } else {
      setAudioState({ playing: false, src: null, currentAyahNumber: null });
      playbackState.current.isPlayingPage = false;
      setIsPlayingPage(false);
    }
  }, []);

  const togglePagePlay = () => {
    if (audioState.playing && playbackState.current.isPlayingPage) {
      audioRef.current.pause();
      setAudioState(prev => ({ ...prev, playing: false }));
      playbackState.current.isPlayingPage = false;
      setIsPlayingPage(false);
    } else {
      if (!pageData || !pageData.ayahs.length) return;
      let startIndex = 0;
      if (selectedAyah && pageData.ayahs.some(a => a.number === selectedAyah.number)) {
        startIndex = pageData.ayahs.findIndex(a => a.number === selectedAyah.number);
      }
      playbackState.current = { isPlayingPage: true, ayahs: pageData.ayahs, currentIndex: startIndex };
      setIsPlayingPage(true);
      playCurrentInSequence();
    }
  };

  const playAyahAudio = (ayahNumber) => {
    const url = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayahNumber}.mp3`;
    if (audioRef.current) {
      if (audioState.src === url && audioState.playing) {
        audioRef.current.pause();
        setAudioState({ ...audioState, playing: false });
        playbackState.current.isPlayingPage = false;
        setIsPlayingPage(false);
      } else {
        playbackState.current.isPlayingPage = false;
        setIsPlayingPage(false);
        audioRef.current.src = url;
        audioRef.current.play();
        setAudioState({ playing: true, src: url, currentAyahNumber: ayahNumber });
      }
    }
  };

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => {
      if (playbackState.current.isPlayingPage) {
        playbackState.current.currentIndex++;
        playCurrentInSequence();
      } else {
        setAudioState({ playing: false, src: null, currentAyahNumber: null });
        setIsPlayingPage(false);
      }
    };
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, [playCurrentInSequence]);

  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    touchEndRef.current = null;
    touchStartRef.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e) => {
    touchEndRef.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (activeView !== 'reader' || touchStartRef.current === null || touchEndRef.current === null) return;
    const distance = touchStartRef.current - touchEndRef.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isRightSwipe && currentPage < 604) {
      setCurrentPage(prev => prev + 1);
    }
    else if (isLeftSwipe && currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  const handleAyahClick = useCallback((ayah) => {
    setSelectedAyah(ayah);
    setTafsir(null);
  }, []);

  const getAIExplanation = async () => {
    if (!selectedAyah) return;
    setIsTafsirLoading(true);
    const result = await fetchTafsirWithRetry(selectedAyah.text);
    setTafsir(result);
    setIsTafsirLoading(false);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    const aiResponse = await fetchAIChatResponse(userMsg);

    setChatMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
    setIsChatLoading(false);
  };

  const copyToClipboard = (text, index) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  const renderMushafText = () => {
    if (!pageData) return null;

    let currentSurah = null;
    const elements = [];

    pageData.ayahs.forEach((ayah) => {
      if (currentSurah !== ayah.surah.number) {
        currentSurah = ayah.surah.number;
        elements.push(
          <div key={`header-${ayah.surah.number}`} className="w-full flex justify-center my-6" style={{ fontSize: '1rem' }}>
            <div className={`
              px-8 py-3 rounded-full border-2 font-quran text-2xl tracking-wider
              ${isDarkMode ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-amber-600/30 text-amber-700 bg-amber-100/50'}
              shadow-sm backdrop-blur-sm
            `}>
              {ayah.surah.name}
            </div>
          </div>
        );

        if (ayah.surah.number !== 1 && ayah.surah.number !== 9 && ayah.numberInSurah === 1) {
          const basmalah = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
          if (ayah.text.startsWith(basmalah)) {
            ayah.display_text = ayah.text.replace(basmalah, '').trim();
          }
          elements.push(
            <div key={`basmalah-${ayah.surah.number}`} className="w-full text-center font-quran mb-6 text-amber-500/90" style={{ fontSize: '1.2em' }}>
              {basmalah}
            </div>
          );
        }
      }

      elements.push(
        <AyahItem
          key={ayah.number}
          ayah={ayah}
          isSelected={selectedAyah?.number === ayah.number}
          isPlayingThisAyah={audioState.currentAyahNumber === ayah.number && audioState.playing}
          isBookmarked={bookmarks.some(b => b.number === ayah.number)}
          onAyahClick={handleAyahClick}
          isDarkMode={isDarkMode}
        />
      );
    });

    return elements;
  };

  const filteredSurahs = surahs.filter(surah =>
    surah.name.includes(surahSearchQuery) ||
    surah.number.toString().includes(surahSearchQuery)
  );

  const themeClasses = isDarkMode
    ? 'mushaf-bg-dark text-gray-100'
    : 'mushaf-bg-light text-gray-900';

  return (
    <div className={`min-h-screen select-none font-ui flex flex-col transition-colors duration-300 ${themeClasses}`} dir="rtl">

      <svg width="0" height="0" className="absolute hidden">
        <symbol id="ayah-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          {/* dwiwra 3adiya w sampa bla zwa9 bzaf */}
          <circle cx="12" cy="12" r="10.5" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="8" strokeWidth="0.5" opacity="0.6" />
        </symbol>
      </svg>

      {/* TOP NAVIGATION */}
      <header className={`
        sticky top-0 z-10 px-4 py-3 flex justify-between items-center backdrop-blur-md border-b
        ${isDarkMode ? 'border-white/5 bg-zinc-950/80' : 'border-black/5 bg-white/80'}
      `}>
        <div className="flex flex-col gap-2 mt-1">
          <h1 className={`text-xl font-bold font-quran ${isDarkMode ? 'text-amber-400' : 'text-amber-700'} leading-none`}>
            القرآن الكريم
          </h1>
          {pageData && activeView === 'reader' && (
            <span className="text-xs opacity-80 flex items-center">
              الجزء {toArabicNum(pageData.ayahs[0].juz)}
              <span className="mx-2.5 text-amber-500/60 text-[10px]">•</span>
              الحزب {toArabicNum(pageData.ayahs[0].hizbQuarter)}
            </span>
          )}
        </div>

        <div className="flex gap-2 items-center">
          {activeView === 'reader' && (
            <div className="flex items-center gap-2">
              <button
                onClick={togglePagePlay}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all
                  ${audioState.playing && isPlayingPage
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                    : (isDarkMode ? 'bg-zinc-800 text-amber-500 hover:bg-zinc-700' : 'bg-gray-100 text-amber-700 hover:bg-gray-200')}
                `}
              >
                {audioState.playing && isPlayingPage ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                <span className="text-xs font-bold pt-0.5">الصفحة</span>
              </button>

              <div className={`flex items-center gap-1 p-1 rounded-full ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                <button onClick={() => setFontSize(prev => Math.min(prev + 4, 60))} className="p-1.5 rounded-full transition text-amber-500">
                  <ZoomIn size={18} />
                </button>
                <div className="w-px h-5 bg-gray-400/30"></div>
                <button onClick={() => setFontSize(prev => Math.max(prev - 4, 16))} className="p-1.5 rounded-full transition text-amber-500">
                  <ZoomOut size={18} />
                </button>
              </div>
            </div>
          )}

          <button onClick={toggleTheme} className="p-2 ml-1 rounded-full transition">
            {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>

        {/* READER VIEW */}
        {activeView === 'reader' && (
          <div className="flex-1 overflow-y-auto px-4 py-8 pb-32 flex flex-col items-center">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-amber-500" />
              </div>
            ) : (
              <div className="w-full max-w-4xl mx-auto transition-all duration-300">
                <div
                  className={`text-justify font-quran transition-all duration-300 py-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: `${fontSize * 2.5}px`,
                    textJustify: 'inter-word'
                  }}
                >
                  {renderMushafText()}
                </div>

                <div className="w-full text-center mt-12 opacity-50 font-ui" style={{ fontSize: '1rem' }}>
                  - {toArabicNum(currentPage)} -
                </div>
              </div>
            )}
          </div>
        )}

        {/* SURAH LIST VIEW */}
        {activeView === 'surahs' && (
          <div className="flex-1 overflow-y-auto px-4 py-6 pb-24 max-w-md mx-auto w-full">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <List className="text-amber-500" /> الفهرس
            </h2>

            <div className={`mb-6 p-1 rounded-xl flex items-center gap-2 border transition-colors ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="p-2 ml-1">
                <Search className="text-amber-500 opacity-70" size={20} />
              </div>
              <input
                type="text"
                placeholder="ابحث عن سورة (مثال: الفاتحة، 18...)"
                value={surahSearchQuery}
                onChange={(e) => setSurahSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none w-full py-3 pr-2 text-base select-text"
              />
              {surahSearchQuery && (
                <button onClick={() => setSurahSearchQuery('')} className="p-2 opacity-50 hover:opacity-100 transition-opacity">
                  <X size={18} />
                </button>
              )}
            </div>

            {isSurahsLoading ? (
              <div className="flex justify-center items-center py-12 opacity-50">
                <Loader2 className="animate-spin text-amber-500" size={32} />
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSurahs.map(surah => {
                  const startPage = SURAH_START_PAGES[surah.number - 1] || 1;
                  return (
                    <button
                      key={surah.number}
                      onClick={() => {
                        setCurrentPage(startPage);
                        setActiveView('reader');
                      }}
                      className={`
                      w-full flex justify-between items-center p-4 rounded-xl border transition
                      ${isDarkMode
                          ? 'border-zinc-800 bg-zinc-900/50'
                          : 'border-zinc-200 bg-white/50'}
                    `}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 font-bold">
                          {surah.number}
                        </div>
                        <div className="text-right">
                          <div className="font-quran text-2xl leading-relaxed pb-1 text-amber-500">{surah.name}</div>
                          <div className="text-xs opacity-60 font-ui">{surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} • {surah.numberOfAyahs} آية</div>
                        </div>
                      </div>
                      <div className="text-sm opacity-50">
                        صفحة {startPage}
                      </div>
                    </button>
                  )
                })}

                {filteredSurahs.length === 0 && (
                  <div className="text-center opacity-50 mt-12 py-8 flex flex-col items-center">
                    <Search size={48} className="mb-4 opacity-20" />
                    <p>لا توجد سورة تطابق بحثك "{surahSearchQuery}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* BOOKMARKS VIEW */}
        {activeView === 'bookmarks' && (
          <div className="flex-1 overflow-y-auto px-4 py-6 pb-24 max-w-md mx-auto w-full">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Bookmark className="text-amber-500" /> العلامات المحفوظة
            </h2>
            {bookmarks.length === 0 ? (
              <div className="text-center opacity-50 mt-12">لا توجد علامات محفوظة.</div>
            ) : (
              <div className="space-y-3">
                {bookmarks.map((bm, idx) => (
                  <button
                    key={bm.number || idx}
                    onClick={() => {
                      sessionStorage.setItem('scroll_to_ayah', bm.number.toString());
                      setCurrentPage(bm.page);
                      setActiveView('reader');
                    }}
                    className={`
                      w-full flex justify-between items-center p-4 rounded-xl border transition text-right
                      ${isDarkMode
                        ? 'border-zinc-800 bg-zinc-900/50'
                        : 'border-zinc-200 bg-white/50'}
                    `}
                  >
                    <div className="flex-1 ml-4 overflow-hidden">
                      <div className="font-quran text-xl leading-relaxed mb-1 pt-1 text-amber-500">
                        {bm.surahName} {bm.ayahInSurah ? <span className="font-ui text-sm text-gray-500">- آية {bm.ayahInSurah}</span> : ''}
                      </div>
                      {bm.text && (
                        <div className="text-sm opacity-70 font-quran truncate mb-1" style={{ maxWidth: "280px", lineHeight: "1.8" }}>
                          {bm.text}
                        </div>
                      )}
                      <div className="text-xs opacity-50 font-ui">صفحة {bm.page}</div>
                    </div>
                    <ChevronLeft size={20} className="opacity-50 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Q&A CHAT VIEW */}
        {activeView === 'qa' && (
          <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto pb-20">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="text-center opacity-50 text-sm mb-6 mt-2">
                اسأل عن التفسير، السيرة، أو الأحكام من القرآن والسنة
              </div>

              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`
                    p-4 rounded-2xl max-w-[85%]
                    ${msg.role === 'user'
                      ? 'bg-amber-600 text-white rounded-tl-sm'
                      : (isDarkMode ? 'bg-zinc-800 text-gray-200 rounded-tr-sm' : 'bg-white border text-gray-800 rounded-tr-sm')}
                  `}>
                    <div className="leading-relaxed font-quran" style={{ fontSize: `${tafsirFontSize}px` }}>{msg.text}</div>
                    {msg.role === 'ai' && (
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => copyToClipboard(msg.text, i)}
                          className="text-amber-500 flex items-center gap-1 text-xs opacity-80"
                        >
                          {copiedIndex === i ? <><Check size={14} className="text-green-500" /> تم النسخ</> : <><Copy size={14} /> نسخ</>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isChatLoading && (
                <div className="flex w-full justify-start">
                  <div className={`p-4 rounded-2xl max-w-[85%] rounded-tr-sm flex items-center gap-2 ${isDarkMode ? 'bg-zinc-800' : 'bg-white border'}`}>
                    <Loader2 size={16} className="animate-spin text-amber-500" /> <span className="text-sm opacity-70">يتم التفكير...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className={`p-4 border-t ${isDarkMode ? 'border-zinc-800 bg-zinc-950/90' : 'border-gray-200 bg-white/90'}`}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="اكتب سؤالك هنا..."
                  className={`
                    flex-1 p-3 rounded-xl outline-none border transition-colors select-text
                    ${isDarkMode ? 'bg-zinc-900 border-zinc-700 focus:border-amber-500' : 'bg-gray-50 border-gray-300 focus:border-amber-500'}
                  `}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isChatLoading || !chatInput.trim()}
                  className={`
                    p-3 rounded-xl flex items-center justify-center transition-colors
                    ${!chatInput.trim() || isChatLoading
                      ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                      : 'bg-amber-500 text-white'}
                  `}
                >
                  <Send size={24} className={isChatLoading ? "opacity-0" : ""} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FLOATING PAGE NAVIGATION */}
      {activeView === 'reader' && (
        <div className="fixed bottom-24 left-0 w-full flex justify-between px-6 pointer-events-none">
          <button
            onClick={() => setCurrentPage(prev => Math.min(604, prev + 1))}
            disabled={currentPage === 604}
            className={`
              pointer-events-auto p-3 rounded-full shadow-lg backdrop-blur-md border transition-transform active:scale-95
              ${isDarkMode ? 'bg-zinc-800/80 border-zinc-700 text-white' : 'bg-white/80 border-gray-200 text-black'}
              ${currentPage === 604 ? 'opacity-30 cursor-not-allowed' : ''}
            `}
          >
            <ChevronRight size={24} />
          </button>

          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={`
              pointer-events-auto p-3 rounded-full shadow-lg backdrop-blur-md border transition-transform active:scale-95
              ${isDarkMode ? 'bg-zinc-800/80 border-zinc-700 text-white' : 'bg-white/80 border-gray-200 text-black'}
              ${currentPage === 1 ? 'opacity-30 cursor-not-allowed' : ''}
            `}
          >
            <ChevronLeft size={24} />
          </button>
        </div>
      )}

      {/* AYAH POPUP - TAFSIR & OPTIONS */}
      {selectedAyah && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedAyah(null); }}>
          <div className={`
            w-full max-w-lg rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto
            ${isDarkMode ? 'bg-zinc-900 border-t border-zinc-800' : 'bg-white border-t border-gray-200'}
          `}>

            <div className="flex justify-between items-start mb-4 sticky top-0 backdrop-blur-md py-2 z-10">
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => playAyahAudio(selectedAyah.number)}
                  className={`
                    p-2.5 rounded-full transition
                    ${audioState.playing && audioState.currentAyahNumber === selectedAyah.number
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                      : (isDarkMode ? 'bg-zinc-800 text-amber-500' : 'bg-gray-100 text-amber-700')}
                  `}
                >
                  {audioState.playing && audioState.currentAyahNumber === selectedAyah.number ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <button
                  onClick={() => toggleBookmark(selectedAyah)}
                  className={`
                    p-2.5 rounded-full transition
                    ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-100'}
                  `}
                >
                  <Bookmark
                    size={18}
                    className={bookmarks.some(b => b.number === selectedAyah.number) ? "fill-amber-500 text-amber-500" : "text-gray-500"}
                  />
                </button>

                {/* TAFSIR ZOOM CONTROLS */}
                <div className={`flex items-center gap-1 p-1 rounded-full ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                  <button onClick={() => setTafsirFontSize(prev => Math.min(prev + 2, 40))} className="p-1.5 rounded-full transition text-amber-500">
                    <ZoomIn size={16} />
                  </button>
                  <div className="w-px h-4 bg-gray-400/30"></div>
                  <button onClick={() => setTafsirFontSize(prev => Math.max(prev - 2, 12))} className="p-1.5 rounded-full transition text-amber-500">
                    <ZoomOut size={16} />
                  </button>
                </div>

              </div>
              <button onClick={() => setSelectedAyah(null)} className="p-1 opacity-50 shrink-0">
                <X size={24} />
              </button>
            </div>

            <div
              className="text-center font-quran leading-loose mb-6 mt-2 text-amber-500 transition-all duration-300"
              style={{ fontSize: `${tafsirFontSize * 1.3}px` }}
            >
              {selectedAyah.text}
            </div>

            {!tafsir ? (
              <button
                onClick={getAIExplanation}
                disabled={isTafsirLoading}
                className={`
                  w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition
                  ${isDarkMode
                    ? 'bg-zinc-800 text-amber-400'
                    : 'bg-amber-50 text-amber-700'}
                `}
              >
                {isTafsirLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                {isTafsirLoading ? 'جاري استخراج التفسير...' : 'تفسير الآية (AI)'}
              </button>
            ) : (
              <div
                className={`
                  p-4 rounded-xl text-justify border transition-all duration-300 font-quran
                  ${isDarkMode ? 'bg-zinc-800/50 border-amber-900/30 text-gray-300' : 'bg-amber-50/50 border-amber-200 text-gray-800'}
                `}
                style={{ fontSize: `${tafsirFontSize}px`, lineHeight: '1.8' }}
              >
                <div className="flex items-center gap-2 mb-3 text-amber-500 font-bold font-ui" style={{ fontSize: `${tafsirFontSize * 1.1}px` }}>
                  <Info size={tafsirFontSize * 1.1} /> التفسير المختصر
                </div>
                {tafsir}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOTTOM APP BAR */}
      <nav className={`
        fixed bottom-0 w-full pb-safe pt-2 px-4 flex justify-between items-center border-t backdrop-blur-md z-20
        ${isDarkMode ? 'bg-zinc-950/90 border-zinc-800' : 'bg-white/90 border-gray-200'}
      `}>
        <button
          onClick={() => setActiveView('reader')}
          className={`flex-1 flex flex-col items-center p-2 transition ${activeView === 'reader' ? 'text-amber-500' : 'opacity-50'}`}
        >
          <BookOpen size={22} className="mb-1" />
          <span className="text-[10px] font-bold">المصحف</span>
        </button>

        <button
          onClick={() => setActiveView('surahs')}
          className={`flex-1 flex flex-col items-center p-2 transition ${activeView === 'surahs' ? 'text-amber-500' : 'opacity-50'}`}
        >
          <List size={22} className="mb-1" />
          <span className="text-[10px] font-bold">الفهرس</span>
        </button>

        <button
          onClick={() => setActiveView('bookmarks')}
          className={`flex-1 flex flex-col items-center p-2 transition ${activeView === 'bookmarks' ? 'text-amber-500' : 'opacity-50'}`}
        >
          <Bookmark size={22} className="mb-1" />
          <span className="text-[10px] font-bold">العلامات</span>
        </button>

        <button
          onClick={() => setActiveView('qa')}
          className={`flex-1 flex flex-col items-center p-2 transition ${activeView === 'qa' ? 'text-amber-500' : 'opacity-50'}`}
        >
          <MessageCircle size={22} className="mb-1" />
          <span className="text-[10px] font-bold">اسأل الذكاء</span>
        </button>
      </nav>

    </div>
  );
}
