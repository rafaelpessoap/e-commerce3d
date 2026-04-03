'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Mail, Eye, Code, Save, Image, Copy, Check } from 'lucide-react';

interface TagInfo {
  tag: string;
  description: string;
}

interface EmailTemplate {
  id: string;
  type: string;
  subject: string;
  htmlBody: string;
  availableTags: string;
  isActive: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  welcome: 'Boas-vindas',
  'order-confirmation': 'Confirmação de Pedido',
  'status-change': 'Mudança de Status',
  'password-reset': 'Redefinição de Senha',
  'review-reward': 'Recompensa de Avaliação',
};

export default function AdminEmailsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data } = await api.get<EmailTemplate[]>('/email-templates');
      return data;
    },
  });

  const { data: galleryData } = useQuery({
    queryKey: ['media-gallery', gallerySearch],
    queryFn: async () => {
      const params: Record<string, string> = { perPage: '20' };
      if (gallerySearch) params.search = gallerySearch;
      const { data } = await api.get('/media', { params });
      return data;
    },
    enabled: showGallery,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; subject: string; htmlBody: string }) => {
      const { data: result } = await api.put(`/email-templates/${data.id}`, {
        subject: data.subject,
        htmlBody: data.htmlBody,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    },
  });

  const selectedTemplate = templates?.find((t) => t.id === selectedId);
  const availableTags: TagInfo[] = selectedTemplate
    ? JSON.parse(selectedTemplate.availableTags)
    : [];

  function selectTemplate(tpl: EmailTemplate) {
    setSelectedId(tpl.id);
    setEditSubject(tpl.subject);
    setEditBody(tpl.htmlBody);
    setViewMode('code');
  }

  function handleSave() {
    if (!selectedId) return;
    updateMutation.mutate({
      id: selectedId,
      subject: editSubject,
      htmlBody: editBody,
    });
  }

  function insertTag(tag: string) {
    const placeholder = `{{${tag}}}`;
    setEditBody((prev) => prev + placeholder);
  }

  function copyTag(tag: string) {
    navigator.clipboard.writeText(`{{${tag}}}`);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1500);
  }

  function insertImage(url: string, alt: string) {
    const imgHtml = `<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;border-radius:6px" />`;
    setEditBody((prev) => prev + imgHtml);
    setShowGallery(false);
  }

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Templates de Email</h1>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Templates de Email</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Lista de templates */}
        <div className="space-y-2">
          {templates?.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => selectTemplate(tpl)}
              className={`w-full text-left rounded-lg border p-4 transition-colors ${
                selectedId === tpl.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">
                  {TYPE_LABELS[tpl.type] ?? tpl.type}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {tpl.subject}
              </p>
            </button>
          ))}
        </div>

        {/* Editor */}
        {selectedTemplate ? (
          <div className="space-y-4">
            {/* Assunto */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                Assunto do Email
              </label>
              <input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use tags como {'{{nome_cliente}}'} no assunto
              </p>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm ${
                  viewMode === 'code'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Code className="h-3.5 w-3.5" />
                HTML
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm ${
                  viewMode === 'preview'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
              <button
                onClick={() => setShowGallery(!showGallery)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-muted text-muted-foreground hover:text-foreground"
              >
                <Image className="h-3.5 w-3.5" />
                Inserir Imagem
              </button>
              <div className="flex-1" />
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1 px-4 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>

            {/* Success message */}
            {updateMutation.isSuccess && (
              <div className="bg-green-50 text-green-700 border border-green-200 rounded-md px-3 py-2 text-sm">
                Template salvo com sucesso!
              </div>
            )}

            {/* Gallery modal */}
            {showGallery && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Buscar imagem..."
                    value={gallerySearch}
                    onChange={(e) => setGallerySearch(e.target.value)}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => setShowGallery(false)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Fechar
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                  {galleryData?.data?.map((img: { id: string; card?: string; gallery?: string; full?: string; thumb?: string; alt?: string; filename?: string }) => (
                    <button
                      key={img.id}
                      onClick={() =>
                        insertImage(
                          img.card ?? img.gallery ?? img.full ?? '',
                          img.alt ?? img.filename ?? '',
                        )
                      }
                      className="aspect-square rounded border overflow-hidden hover:ring-2 ring-primary"
                    >
                      <img
                        src={img.thumb || img.card}
                        alt={img.alt || img.filename}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )) ?? (
                    <p className="col-span-full text-sm text-muted-foreground">
                      Nenhuma imagem na galeria
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Editor / Preview */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
              <div>
                {viewMode === 'code' ? (
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full h-[500px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none"
                    spellCheck={false}
                  />
                ) : (
                  <div className="border rounded-md bg-white overflow-auto h-[500px]">
                    <iframe
                      srcDoc={editBody}
                      className="w-full h-full border-0"
                      title="Email Preview"
                      sandbox=""
                    />
                  </div>
                )}
              </div>

              {/* Tags sidebar */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Tags Disponíveis</h3>
                <p className="text-xs text-muted-foreground">
                  Clique para copiar, ou use o botão + para inserir no final do HTML.
                </p>
                <div className="space-y-1.5">
                  {availableTags.map((tagInfo) => (
                    <div
                      key={tagInfo.tag}
                      className="flex items-center gap-1.5 group"
                    >
                      <button
                        onClick={() => copyTag(tagInfo.tag)}
                        className="flex-1 text-left rounded border px-2 py-1.5 text-xs font-mono bg-muted/50 hover:bg-muted transition-colors"
                        title={tagInfo.description}
                      >
                        <span className="text-primary">{`{{${tagInfo.tag}}}`}</span>
                        <span className="block text-muted-foreground text-[10px] mt-0.5">
                          {tagInfo.description}
                        </span>
                      </button>
                      {copiedTag === tagInfo.tag ? (
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                      )}
                      <button
                        onClick={() => insertTag(tagInfo.tag)}
                        className="text-xs text-primary hover:underline shrink-0"
                        title="Inserir no final"
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>Selecione um template para editar</p>
          </div>
        )}
      </div>
    </div>
  );
}
