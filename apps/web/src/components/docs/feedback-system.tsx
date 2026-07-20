'use client';

import { AlertCircle, Lightbulb, Star, ThumbsDown, ThumbsUp } from '@/lib/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/utils/toast';
import { ExclamationCircleIcon, CheckCircleIcon, ChatBubbleLeftRightIcon, PaperAirplaneIcon, StarIcon, HandThumbDownIcon, HandThumbUpIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';

interface FeedbackData {
  type: 'helpful' | 'not-helpful' | 'suggestion' | 'bug-report' | 'feature-request';
  rating?: number;
  comment: string;
  email?: string;
  category: string;
  page: string;
  userAgent: string;
}

interface FeedbackSystemProps {
  page: string;
  category: string;
  onSubmit?: (feedback: FeedbackData) => Promise<void>;
}

export function FeedbackSystem({ page, category, onSubmit }: FeedbackSystemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackData['type']>('helpful');
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleQuickFeedback = async (type: 'helpful' | 'not-helpful') => {
    setIsSubmitting(true);
    try {
      const feedback: FeedbackData = {
        type,
        comment: '',
        category,
        page,
        userAgent: navigator.userAgent
      };

      if (onSubmit) {
        await onSubmit(feedback);
      } else {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast.success('Thank you for your feedback!');
    } catch (error) {
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetailedFeedback = async () => {
    if (!comment.trim()) {
      toast.error('Please provide some feedback before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const feedback: FeedbackData = {
        type: feedbackType,
        rating: rating > 0 ? rating : undefined,
        comment: comment.trim(),
        email: email.trim() || undefined,
        category,
        page,
        userAgent: navigator.userAgent
      };

      if (onSubmit) {
        await onSubmit(feedback);
      } else {
        // Simulate API call with analytics tracking
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Track feedback analytics (in real implementation)
        console.log('Feedback submitted:', {
          ...feedback,
          timestamp: new Date().toISOString(),
          sessionId: crypto.randomUUID()
        });
      }

      setSubmitted(true);
      toast.success('Thank you for your detailed feedback!');

      // Reset form after a delay
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setComment('');
        setEmail('');
        setRating(0);
        setFeedbackType('helpful');
      }, 2000);
    } catch (error) {
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackTypes = [
    { value: 'helpful', label: 'This was helpful', icon: ThumbsUp },
    { value: 'not-helpful', label: 'This was not helpful', icon: ThumbsDown },
    { value: 'suggestion', label: 'I have a suggestion', icon: Lightbulb },
    { value: 'bug-report', label: 'Report a bug', icon: AlertCircle },
    { value: 'feature-request', label: 'Request a feature', icon: Star }
  ];

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <ChatBubbleLeftRightIcon className="h-5 w-5" />
          Was this helpful?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Feedback Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickFeedback('helpful')}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            <HandThumbUpIcon className="h-4 w-4" />
            Yes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickFeedback('not-helpful')}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            <HandThumbDownIcon className="h-4 w-4" />
            No
          </Button>
        </div>

        {/* Detailed Feedback Dialog */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Leave detailed feedback
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Share Your Feedback</DialogTitle>
            </DialogHeader>

            {submitted ? (
              <div className="text-center py-6 space-y-4">
                <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto" />
                <div>
                  <h3 className="font-medium">Thank you!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your feedback helps us improve our documentation.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Feedback Type */}
                <div className="space-y-2">
                  <Label>Feedback Type</Label>
                  <Select value={feedbackType} onValueChange={(value: any) => setFeedbackType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {feedbackTypes.map((type) => {
                        const Icon = type.icon;
                        return (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Rating (for helpful/not-helpful feedback) */}
                {(feedbackType === 'helpful' || feedbackType === 'not-helpful') && (
                  <div className="space-y-2">
                    <Label>Rating (optional)</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Button
                          key={star}
                          variant="ghost"
                          size="sm"
                          className="p-1 h-8 w-8"
                          onClick={() => setRating(star)}
                        >
                          <StarIcon
                            className={`h-4 w-4 ${star <= rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-muted-foreground'
                              }`}
                          />
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comment */}
                <div className="space-y-2">
                  <Label htmlFor="comment">
                    {feedbackType === 'bug-report'
                      ? 'Describe the issue'
                      : feedbackType === 'feature-request'
                        ? 'Describe the feature'
                        : feedbackType === 'suggestion'
                          ? 'Your suggestion'
                          : 'Additional comments'
                    }
                  </Label>
                  <Textarea
                    id="comment"
                    placeholder={
                      feedbackType === 'bug-report'
                        ? 'Please describe what went wrong and steps to reproduce...'
                        : feedbackType === 'feature-request'
                          ? 'What feature would you like to see?'
                          : feedbackType === 'suggestion'
                            ? 'How can we improve this?'
                            : 'Tell us more about your experience...'
                    }
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Email (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    We'll only use this to follow up on your feedback if needed.
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleDetailedFeedback}
                  disabled={isSubmitting || !comment.trim()}
                  className="w-full"
                >
                  {isSubmitting ? (
                    'Submitting...'
                  ) : (
                    <>
                      <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                      Submit Feedback
                    </>
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Page Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">{category}</Badge>
            <Badge variant="outline" className="text-xs">{page}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}