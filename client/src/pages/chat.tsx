import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function Chat() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Chat AI</h1>
        <p className="text-muted-foreground">
          Trợ lý dược lâm sàng thông minh
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chat với AI Assistant</CardTitle>
          <CardDescription>Hỏi đáp về dược lâm sàng, tương tác thuốc, và hơn thế nữa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Chức năng đang được phát triển</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
