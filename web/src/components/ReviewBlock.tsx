import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { postOrderReview } from "@/lib/queries";
import { Button, Textarea, useToast } from "@/components/ui";

/**
 * Buyer review widget for a COMPLETED order line. Shows the existing review if
 * one exists, otherwise a star-rating + comment form that posts a real review.
 */
export default function ReviewBlock({
  lineId, review, onChanged,
}: {
  lineId: string;
  review?: { id: string; rating: number; comment?: string | null } | null;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  const submit = useMutation({
    mutationFn: () => postOrderReview(lineId, { rating, comment: comment || undefined }),
    onSuccess: () => { toast.push("success", "Thanks for your review!"); onChanged(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not submit review."),
  });

  if (review) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-subtle p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Your review</p>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={`h-4 w-4 ${n <= review.rating ? "fill-brand-500 text-brand-500" : "text-ink-faint"}`} />
          ))}
        </div>
        {review.comment && <p className="mt-1.5 text-sm text-ink-soft">"{review.comment}"</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-surface-border p-3">
      <p className="mb-2 text-sm font-semibold text-ink">Rate this service</p>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} star`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} className="p-0.5">
            <Star className={`h-6 w-6 transition ${n <= (hover || rating) ? "fill-brand-500 text-brand-500" : "text-ink-faint hover:text-brand-300"}`} />
          </button>
        ))}
        {rating > 0 && <span className="ml-2 text-sm text-ink-muted">{rating}/5</span>}
      </div>
      <Textarea rows={2} className="mt-2" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share how the provider did (optional)" />
      <Button className="mt-2 btn-sm" loading={submit.isPending} disabled={rating === 0} onClick={() => submit.mutate()}>Submit review</Button>
    </div>
  );
}
