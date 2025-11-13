import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, X, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  response: string;
  caseId?: string;
  createdAt: string;
}

export function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chatHistory, isLoading: loadingHistory } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat"],
    enabled: isOpen,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      return response.json();
    },
    onSuccess: (serverResponse: ChatMessage) => {
      queryClient.setQueryData<ChatMessage[]>(["/api/chat"], (old) => {
        return old ? [...old, serverResponse] : [serverResponse];
      });
      setCurrentMessage("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Không thể gửi tin nhắn",
      });
    },
  });

  const handleSend = () => {
    if (!currentMessage.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(currentMessage);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (isOpen && chatHistory && chatHistory.length > 0) {
      scrollToBottom();
    }
  }, [isOpen, chatHistory?.length]);

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsOpen(false)}
          data-testid="chatbot-overlay"
        />
      )}

      <div className="fixed bottom-6 right-6 z-50">
        {isOpen && (
          <Card className="w-96 h-[600px] mb-4 flex flex-col shadow-2xl">
            <CardHeader className="border-b pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <Bot className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Trợ lý ảo Cửa Đông Care</CardTitle>
                    <CardDescription className="text-xs">
                      Trợ lý dược lâm sàng
                    </CardDescription>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  data-testid="button-close-chat"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                {loadingHistory ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : chatHistory && chatHistory.length > 0 ? (
                  <div className="space-y-4">
                    {chatHistory.map((msg, idx) => (
                      <div key={msg.id} className="space-y-2">
                        <div className="flex justify-end">
                          <div 
                            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%] break-words"
                            data-testid={`message-user-${idx}`}
                          >
                            <p className="text-sm">{msg.message}</p>
                          </div>
                        </div>
                        <div className="flex justify-start">
                          <div 
                            className="bg-muted rounded-lg px-4 py-2 max-w-[80%] break-words"
                            data-testid={`message-assistant-${idx}`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.response}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <Bot className="w-12 h-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">
                      Xin chào! Em là trợ lý ảo Cửa Đông Care
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Em có thể hỗ trợ anh/chị về các vấn đề dược lâm sàng
                    </p>
                  </div>
                )}

                {sendMessageMutation.isPending && sendMessageMutation.variables && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-end">
                      <div 
                        className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%] break-words"
                        data-testid="message-user-pending"
                      >
                        <p className="text-sm">{sendMessageMutation.variables}</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div 
                        className="bg-muted rounded-lg px-4 py-2 break-words"
                        data-testid="message-assistant-loading"
                      >
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                )}
              </ScrollArea>

              <div className="border-t p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    placeholder="Nhập câu hỏi của bạn..."
                    disabled={sendMessageMutation.isPending}
                    data-testid="input-chat-message"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!currentMessage.trim() || sendMessageMutation.isPending}
                    data-testid="button-send-message"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          size="icon"
          className="w-14 h-14 rounded-full shadow-2xl"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="button-toggle-chatbot"
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Bot className="w-6 h-6" />
          )}
        </Button>
      </div>
    </>
  );
}
