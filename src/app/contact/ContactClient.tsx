'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Send, CheckCircle2, AlertCircle, ArrowLeft, Bug, MessageSquare, HelpCircle, Image as ImageIcon, X } from 'lucide-react';
import Link from 'next/link';
import Hero from '@/components/Hero';
import { useLocale } from '@/components/LocaleProvider';
import { sendInquiry, type InquiryData } from './actions';
import { createClient } from '@/utils/supabase/client';

type Category = 'bug' | 'feedback' | 'other';

export default function ContactClient() {
  const { T } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<InquiryData>({
    name: '',
    email: '',
    category: 'feedback',
    message: '',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 5MB 制限
    if (file.size > 5 * 1024 * 1024) {
      setError(T('contact.form.fileSizeError'));
      return;
    }

    // 画像ファイル以外のチェック
    if (!file.type.startsWith('image/')) {
      setError(T('contact.form.fileTypeError'));
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    setError(null);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let imageUrl = undefined;

      // 画像のアップロード
      if (selectedFile) {
        const supabase = createClient();
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('contact_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;
        imageUrl = filePath;
      }

      const result = await sendInquiry({
        ...formData,
        imageUrl,
      });

      if (result.success) {
        setIsSuccess(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(result.error || '不明なエラーが発生しました');
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || '送信中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: 'bug', label: T('contact.form.categories.bug'), icon: <Bug size={18} /> },
    { id: 'feedback', label: T('contact.form.categories.feedback'), icon: <MessageSquare size={18} /> },
    { id: 'other', label: T('contact.form.categories.other'), icon: <HelpCircle size={18} /> },
  ];

  if (isSuccess) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-[var(--bg-secondary)]/50 backdrop-blur-xl border border-[var(--border)] p-10 rounded-3xl text-center shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#ff4e8e] to-[#8e4eff]" />
          
          <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          
          <h2 className="text-2xl font-black mb-4 text-[var(--text-primary)]">
            {T('contact.form.successTitle')}
          </h2>
          <p className="text-[var(--text-secondary)] mb-8 leading-relaxed">
            {T('contact.form.successMessage')}
          </p>
          
          <Link 
            href="/" 
            className="inline-flex items-center justify-center w-full py-4 px-6 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold rounded-2xl transition-all duration-300 shadow-lg shadow-[var(--accent-glow)] group"
          >
            <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            {T('common.backToHome')}
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <Hero 
        title={T('contact.title')}
        description={T('contact.subtitle')}
        icon={<Mail size={48} />}
        centered
      />

      <div className="container max-w-3xl mx-auto px-6 -mt-8 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--bg-secondary)]/30 backdrop-blur-2xl border border-white/10 p-8 md:p-12 rounded-[2.5rem] shadow-2xl overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--accent)] to-indigo-500 opacity-50" />

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* 名前 */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-[var(--text-secondary)] ml-1 flex items-center">
                  {T('contact.form.name')}
                  <span className="ml-2 text-[10px] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-md opacity-60">Optional</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={T('contact.form.namePlaceholder')}
                  className="w-full bg-[var(--bg-primary)]/50 border border-[var(--border)] focus:border-[var(--accent)] rounded-2xl px-5 py-4 text-[var(--text-primary)] transition-all outline-none"
                />
              </div>

              {/* メールアドレス */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-[var(--text-secondary)] ml-1 flex items-center">
                  {T('contact.form.email')}
                  <span className="ml-2 text-[10px] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-md opacity-60">Optional</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={T('contact.form.emailPlaceholder')}
                  className="w-full bg-[var(--bg-primary)]/50 border border-[var(--border)] focus:border-[var(--accent)] rounded-2xl px-5 py-4 text-[var(--text-primary)] transition-all outline-none"
                />
              </div>
            </div>

            {/* カテゴリ選択 */}
            <div className="space-y-4">
              <label className="text-sm font-bold text-[var(--text-secondary)] ml-1">
                {T('contact.form.category')}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.id as Category })}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 gap-2 ${
                      formData.category === cat.id
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg scale-105'
                        : 'bg-[var(--bg-primary)]/40 border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:bg-[var(--bg-primary)]/60'
                    }`}
                  >
                    {cat.icon}
                    <span className="text-xs font-bold">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 画像の添付 */}
            <div className="space-y-4">
              <label className="text-sm font-bold text-[var(--text-secondary)] ml-1 flex items-center justify-between">
                <span>{T('contact.form.image')}</span>
                <span className="text-[10px] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-md opacity-60 uppercase">Max 5MB</span>
              </label>
              
              <div className="flex items-start gap-4">
                {!previewUrl ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center w-32 h-32 rounded-2xl border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all text-[var(--text-tertiary)] hover:text-[var(--accent)] group"
                  >
                    <ImageIcon size={32} className="mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold">Select Image</span>
                  </button>
                ) : (
                  <div className="relative group w-32 h-32">
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover rounded-2xl border border-[var(--border)]"
                    />
                    <button
                      type="button"
                      onClick={removeFile}
                      className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                      title={T('contact.form.imageRemove')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex-1 text-xs text-[var(--text-tertiary)] leading-relaxed pt-2">
                  <p>• {T('contact.form.imageDesc')}</p>
                  <p>• Accepted: PNG, JPG, WEBP</p>
                </div>
              </div>
            </div>

            {/* メッセージ内容 */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-[var(--text-secondary)] ml-1">
                {T('contact.form.message')}
                <span className="ml-2 text-[10px] text-[var(--accent)] font-black">REQUIRED</span>
              </label>
              <textarea
                required
                rows={6}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder={T('contact.form.messagePlaceholder')}
                className="w-full bg-[var(--bg-primary)]/50 border border-[var(--border)] focus:border-[var(--accent)] rounded-3xl px-5 py-4 text-[var(--text-primary)] transition-all outline-none resize-none"
              />
            </div>

            {/* エラー表示 */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl flex items-center gap-3 overflow-hidden"
                >
                  <AlertCircle size={20} />
                  <span className="text-sm font-bold">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 transition-all duration-500 relative overflow-hidden group shadow-xl ${
                isSubmitting 
                ? 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed'
                : 'bg-gradient-to-r from-[#ff4e8e] to-[#8e4eff] text-white hover:scale-[1.02] active:scale-[0.98] shadow-[var(--accent-glow)]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full"
                  />
                  {T('contact.form.submitting')}
                </>
              ) : (
                <>
                  {T('contact.form.submit')}
                  <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
