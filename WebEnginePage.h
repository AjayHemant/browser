#ifndef WEBENGINEPAGE_H
#define WEBENGINEPAGE_H

#include <QWebEnginePage>

class WebEnginePage : public QWebEnginePage
{
    Q_OBJECT

public:
    explicit WebEnginePage(QObject *parent = nullptr);

protected:
    QWebEnginePage *createWindow(WebWindowType type) override;
};

#endif // WEBENGINEPAGE_H
